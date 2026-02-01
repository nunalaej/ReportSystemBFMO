// api/reports.js
const express = require("express");
const router = express.Router();
const multer = require("multer");

const Report = require("../models/Report");
const cloudinary = require("../config/cloudinary");
const { sendReportStatusEmail } = require("../utils/mailer");

/* ============================================================
   MULTER CONFIG (MEMORY STORAGE)
============================================================ */
const upload = multer({
  storage: multer.memoryStorage(),
});

/* ============================================================
   IMAGE VALIDATION CONFIG
============================================================ */
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
  "image/gif",
];

/* ============================================================
   GET ALL REPORTS
   GET /api/reports
============================================================ */
router.get("/", async (req, res) => {
  try {
    const reports = await Report.find().sort({ createdAt: -1 });
    res.json({ success: true, reports });
  } catch (err) {
    console.error("GET /reports error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to load reports",
    });
  }
});

/* ============================================================
   GET SINGLE REPORT
   GET /api/reports/:id
============================================================ */
router.get("/:id", async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    res.json({ success: true, report });
  } catch (err) {
    console.error("GET /reports/:id error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to load report",
    });
  }
});

/* ============================================================
   CREATE REPORT
   POST /api/reports
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
    } = req.body;

    /* ============================
       IMAGE VALIDATION (SERVER)
    ============================ */
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Image is required.",
      });
    }

    if (!ALLOWED_IMAGE_MIME_TYPES.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid image type. Only JPG, PNG, HEIC, WEBP, GIF are allowed.",
      });
    }

    if (req.file.size > MAX_IMAGE_SIZE) {
      return res.status(400).json({
        success: false,
        message: "Image exceeds 10MB limit.",
      });
    }

    /* ============================
       UPLOAD TO CLOUDINARY
    ============================ */
    const uploaded = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "bfmo_reports" },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    const ImageFile = uploaded.secure_url;

    /* ============================
       SAVE TO DATABASE
    ============================ */
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
    });

    return res.status(201).json({
      success: true,
      report,
    });
  } catch (err) {
    console.error("POST /reports error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to create report.",
    });
  }
});

/* ============================================================
   UPDATE REPORT (STATUS / COMMENTS)
   PUT /api/reports/:id
============================================================ */
router.put("/:id", async (req, res) => {
  try {
    const { status, overwriteComments, comments } = req.body;

    const existing = await Report.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    const oldStatus = existing.status || "Pending";

    if (status) {
      existing.status = status;
    }

    if (overwriteComments && Array.isArray(comments)) {
      existing.comments = comments;
    }

    const updated = await existing.save();

    /* ============================
       EMAIL NOTIFICATION
    ============================ */
    if (status && status !== oldStatus) {
      sendReportStatusEmail({
        to: updated.email,
        heading: updated.heading,
        status: updated.status,
        reportId: String(updated._id),
      }).catch((err) => {
        console.error("Email send failed:", err);
      });
    }

    res.json({ success: true, report: updated });
  } catch (err) {
    console.error("PUT /reports/:id error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update report",
    });
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
      return res.status(400).json({
        success: false,
        message: "Comment text is required",
      });
    }

    const newComment = {
      text,
      by: by || "Admin",
      at: new Date(),
    };

    const updated = await Report.findByIdAndUpdate(
      req.params.id,
      { $push: { comments: newComment } },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    res.json({ success: true, report: updated });
  } catch (err) {
    console.error("POST comment error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to add comment",
    });
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
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    const idx = parseInt(index, 10);
    if (isNaN(idx) || idx < 0 || idx >= report.comments.length) {
      return res.status(400).json({
        success: false,
        message: "Invalid comment index",
      });
    }

    report.comments.splice(idx, 1);
    await report.save();

    res.json({ success: true, report });
  } catch (err) {
    console.error("DELETE comment error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to delete comment",
    });
  }
});

/* ============================================================
   EXPORT ROUTER
============================================================ */
module.exports = router;
