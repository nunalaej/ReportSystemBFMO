// api/reports.js  (UPDATED)
//
// Changes from original:
//   • POST /api/reports  → accepts `reporterType` field
//   • GET  /api/reports  → also merges ArchivedReport documents so analytics
//                          always has the full picture (query param: ?includeArchived=1)
//   • GET  /api/reports  → supports ?reporterType= filter
//   • reportId is generated automatically by the Report model pre-save hook
//   • Manual cleanup endpoint: POST /api/reports/admin/annual-cleanup

const express = require("express");
const router  = express.Router();
const multer  = require("multer");

const Report         = require("../models/Report");
const ArchivedReport = require("../models/ArchivedReport");
const cloudinary     = require("../config/cloudinary");
const { sendReportStatusEmail } = require("../utils/mailer");
const { runAnnualCleanup }      = require("../jobs/annualCleanup");

/* ============================================================
   MULTER CONFIG (MEMORY STORAGE)
============================================================ */
const upload = multer({ storage: multer.memoryStorage() });

/* ============================================================
   IMAGE VALIDATION CONFIG
============================================================ */
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
  "image/gif",
];

/* ============================================================
   ADMIN: MANUAL CLEANUP TRIGGER
   POST /api/reports/admin/annual-cleanup
   Body: { secret: "YOUR_ADMIN_SECRET", dryRun?: true }
============================================================ */
router.post("/admin/annual-cleanup", async (req, res) => {
  const { secret, dryRun } = req.body || {};

  // Simple secret guard – set ADMIN_SECRET in your .env
  const expected = process.env.ADMIN_SECRET || "bfmo-admin-2024";
  if (secret !== expected) {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }

  try {
    const result = await runAnnualCleanup({ dryRun: Boolean(dryRun) });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("Manual cleanup error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ============================================================
   GET ALL REPORTS
   GET /api/reports
   Query params:
     ?includeArchived=1   → also merge ArchivedReport documents
     ?reporterType=Student|Staff/Faculty  → filter by reporter type
============================================================ */
router.get("/", async (req, res) => {
  try {
    const { includeArchived, reporterType } = req.query;

    // Build filter for live reports
    const filter = {};
    if (reporterType && reporterType !== "All") {
      filter.reporterType = reporterType;
    }

    let reports = await Report.find(filter).sort({ createdAt: -1 }).lean();

    // Optionally merge archived (analytics use-case)
    if (includeArchived === "1" || includeArchived === "true") {
      const archiveFilter = {};
      if (reporterType && reporterType !== "All") {
        archiveFilter.reporterType = reporterType;
      }

      const archived = await ArchivedReport.find(archiveFilter)
        .sort({ createdAt: -1 })
        .lean();

      // Normalise archived docs to look like Report docs for the frontend
      const normalisedArchived = archived.map((a) => ({
        _id:          a.originalId,
        reportId:     a.reportId,
        email:        a.email,
        heading:      a.heading,
        description:  a.description,
        concern:      a.concern,
        subConcern:   a.subConcern,
        otherConcern: a.otherConcern,
        building:     a.building,
        otherBuilding:a.otherBuilding,
        college:      a.college,
        floor:        a.floor,
        room:         a.room,
        otherRoom:    a.otherRoom,
        image:        a.image,
        ImageFile:    a.ImageFile,
        status:       a.status,
        reporterType: a.reporterType,
        comments:     a.comments,
        createdAt:    a.createdAt,
        _isArchived:  true,   // flag so frontend knows it's a purged record
      }));

      reports = [...reports, ...normalisedArchived].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
    }

    res.json({ success: true, reports });
  } catch (err) {
    console.error("GET /reports error:", err);
    res.status(500).json({ success: false, message: "Failed to load reports" });
  }
});

/* ============================================================
   GET SINGLE REPORT
   GET /api/reports/:id
============================================================ */
router.get("/:id", async (req, res) => {
  try {
    // Try live collection first
    let report = await Report.findById(req.params.id).lean();

    // Fall back to archived collection
    if (!report) {
      const archived = await ArchivedReport.findOne({
        originalId: req.params.id,
      }).lean();

      if (archived) {
        report = {
          _id:         archived.originalId,
          reportId:    archived.reportId,
          ...archived,
          _isArchived: true,
        };
      }
    }

    if (!report) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }

    res.json({ success: true, report });
  } catch (err) {
    console.error("GET /reports/:id error:", err);
    res.status(500).json({ success: false, message: "Failed to load report" });
  }
});

/* ============================================================
   CREATE REPORT
   POST /api/reports
   Body (multipart):
     + reporterType  "Student" | "Staff/Faculty"  (NEW)
============================================================ */
router.post("/", upload.single("ImageFile"), async (req, res) => {
  try {
    const {
      email,
      heading,
      description,
      concern,
      subConcern,
      building,
      college,
      floor,
      room,
      otherConcern,
      otherBuilding,
      otherRoom,
      reporterType,       // NEW
    } = req.body;

    /* ── Image validation ─────────────────────────────────────────────── */
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Image is required." });
    }

    if (!ALLOWED_IMAGE_MIME_TYPES.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: "Invalid image type. Only JPG, PNG, HEIC, WEBP, GIF are allowed.",
      });
    }

    if (req.file.size > MAX_IMAGE_SIZE) {
      return res.status(400).json({ success: false, message: "Image exceeds 10 MB limit." });
    }

    /* ── Upload to Cloudinary ─────────────────────────────────────────── */
    const uploaded = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "bfmo_reports" },
        (error, result) => (error ? reject(error) : resolve(result))
      );
      stream.end(req.file.buffer);
    });

    const ImageFile = uploaded.secure_url;

    /* ── Save to database ─────────────────────────────────────────────── */
    // reportId is auto-generated by the pre-save hook in the model
    const report = await Report.create({
      email,
      heading,
      description,
      concern,
      subConcern,
      building,
      college,
      floor,
      room,
      otherConcern,
      otherBuilding,
      otherRoom,
      ImageFile,
      reporterType: reporterType || "Student",   // NEW
    });

    return res.status(201).json({ success: true, report });
  } catch (err) {
    console.error("POST /reports error:", err);
    res.status(500).json({ success: false, message: "Failed to create report." });
  }
});

/* ============================================================
   UPDATE REPORT (STATUS / COMMENTS)
   PUT /api/reports/:id
============================================================ */
router.put("/:id", async (req, res) => {
  try {
    const { status, overwriteComments, comments, comment } = req.body;

    const existing = await Report.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }

    const oldStatus = existing.status || "Pending";

    if (status) existing.status = status;

    if (overwriteComments && Array.isArray(comments)) {
      existing.comments = comments;
    }

    const updated = await existing.save();

    /* ── Email notification ────────────────────────────────────────────── */
    if (status && status !== oldStatus) {
      sendReportStatusEmail({
        to:       updated.email,
        heading:  updated.heading,
        status:   updated.status,
        reportId: String(updated._id),
        comment:  comment || "",
      }).catch((err) => console.error("Email send failed:", err));
    }

    res.json({ success: true, report: updated });
  } catch (err) {
    console.error("PUT /reports/:id error:", err);
    res.status(500).json({ success: false, message: "Failed to update report" });
  }
});

/* ============================================================
   ADD COMMENT
   POST /api/reports/:id/comments
============================================================ */
router.post("/:id/comments", async (req, res) => {
  try {
    const { text, by } = req.body;

    if (!text) {
      return res.status(400).json({ success: false, message: "Comment text is required" });
    }

    const newComment = { text, by: by || "Admin", at: new Date() };

    const updated = await Report.findByIdAndUpdate(
      req.params.id,
      { $push: { comments: newComment } },
      { returnDocument: "after" }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }

    res.json({ success: true, report: updated });
  } catch (err) {
    console.error("POST comment error:", err);
    res.status(500).json({ success: false, message: "Failed to add comment" });
  }
});

/* ============================================================
   DELETE COMMENT
   DELETE /api/reports/:id/comments/:index
============================================================ */
router.delete("/:id/comments/:index", async (req, res) => {
  try {
    const { id, index } = req.params;

    const report = await Report.findById(id);
    if (!report) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }

    const idx = parseInt(index, 10);
    if (isNaN(idx) || idx < 0 || idx >= report.comments.length) {
      return res.status(400).json({ success: false, message: "Invalid comment index" });
    }

    report.comments.splice(idx, 1);
    await report.save();

    res.json({ success: true, report });
  } catch (err) {
    console.error("DELETE comment error:", err);
    res.status(500).json({ success: false, message: "Failed to delete comment" });
  }
});

module.exports = router;