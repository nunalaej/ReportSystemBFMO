const express = require("express");
const router  = express.Router();
const multer  = require("multer");

const Report     = require("../models/Report");
const cloudinary = require("../config/cloudinary");
const { sendReportStatusEmail } = require("../utils/mailer");

const upload = multer({ storage: multer.memoryStorage() });

const MAX_IMAGE_SIZE           = 10 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg", "image/png", "image/heic",
  "image/heif", "image/webp", "image/gif",
];

/* ── Report ID Generator ── */
async function generateReportId() {
  const now    = new Date();
  const dd     = String(now.getDate()).padStart(2, "0");
  const mm     = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy   = String(now.getFullYear()).slice(-2);
  const prefix = `${dd}${mm}${yyyy}`;
  const count  = await Report.countDocuments({ reportId: { $regex: `^${prefix}` } });
  return `${prefix}${String(count + 1).padStart(3, "0")}`;
}

/* ============================================================
   GET ALL REPORTS
============================================================ */
router.get("/", async (req, res) => {
  try {
    const reports = await Report.find({}).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, reports });
  } catch (err) {
    console.error("GET /reports error:", err);
    return res.status(500).json({ success: false, message: "Failed to load reports." });
  }
});

/* ============================================================
   GET SINGLE REPORT
============================================================ */
router.get("/:id", async (req, res) => {
  try {
    const report = await Report.findById(req.params.id).lean();
    if (!report) return res.status(404).json({ success: false, message: "Report not found." });
    return res.json({ success: true, report });
  } catch (err) {
    console.error("GET /reports/:id error:", err);
    return res.status(500).json({ success: false, message: "Failed to load report." });
  }
});

/* ============================================================
   CREATE REPORT
============================================================ */
router.post("/", upload.single("ImageFile"), async (req, res) => {
  try {
    const {
      email, heading, description, concern, subConcern,
      building, college, floor, room,
      otherConcern, otherBuilding, otherRoom,
      userType, inheritedStatus,
    } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, message: "Image is required." });
    }
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(req.file.mimetype)) {
      return res.status(400).json({ success: false, message: "Invalid image type. Only JPG, PNG, HEIC, WEBP, GIF are allowed." });
    }
    if (req.file.size > MAX_IMAGE_SIZE) {
      return res.status(400).json({ success: false, message: "Image exceeds 10MB limit." });
    }

    const uploaded = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "bfmo_reports" },
        (error, result) => { if (error) return reject(error); resolve(result); }
      );
      stream.end(req.file.buffer);
    });

    const reportId       = await generateReportId();
    const startingStatus = inheritedStatus || "Pending";

    const report = await Report.create({
      reportId, email, heading, description,
      concern, subConcern, building, college,
      floor, room, otherConcern, otherBuilding,
      otherRoom, userType,
      ImageFile: uploaded.secure_url,
      status: startingStatus,
      history: [{
        status: startingStatus,
        at:     new Date(),
        by:     email || "Reporter",
        note:   "Report submitted.",
      }],
    });

    return res.status(201).json({ success: true, report });
  } catch (err) {
    console.error("POST /reports error:", err);
    return res.status(500).json({ success: false, message: "Failed to create report." });
  }
});

/* ============================================================
   UPDATE REPORT
   Supports: status, comment, sendEmail, updatedBy,
             concern (admin correction),
             comments + overwriteComments (bulk comment sync)
============================================================ */
router.put("/:id", async (req, res) => {
  try {
    const {
      status,
      comment,
      sendEmail,
      updatedBy,
      concern,              // ← NEW: admin concern-type correction
      comments,             // ← bulk comment overwrite
      overwriteComments,    // ← flag to replace all comments
    } = req.body;

    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ success: false, message: "Report not found." });
    }

    const oldStatus    = report.status;
    const statusChanged = status && status !== oldStatus;

    /* ── Update status ── */
    if (statusChanged) {
      report.status = status;
      if (!Array.isArray(report.history)) report.history = [];
      report.history.push({
        status: status,
        at:     new Date(),
        by:     updatedBy || "Admin",
        note:   comment || `Status changed from ${oldStatus} to ${status}`,
      });
    }

    /* ── Correct concern type (admin only) ── */
    if (concern !== undefined && concern !== null && concern !== "") {
      report.concern = concern;
    }

    /* ── Add inline comment ── */
    if (comment && !overwriteComments) {
      if (!Array.isArray(report.comments)) report.comments = [];
      report.comments.push({
        text: comment,
        by:   updatedBy || "Admin",
        at:   new Date(),
      });
    }

    /* ── Bulk-overwrite comments (edit/delete from modal) ── */
    if (overwriteComments && Array.isArray(comments)) {
      report.comments = comments;
    }

    await report.save();

    /* ── Email notification ── */
    if (sendEmail === true && statusChanged && report.email) {
      sendReportStatusEmail({
        to:       report.email,
        heading:  report.heading,
        status:   status,
        reportId: report.reportId || String(report._id),
        comment:  comment || "",
      }).catch(err => console.error("[Backend] Email error:", err.message));
    }

    return res.json({ success: true, report });
  } catch (err) {
    console.error("PUT /reports/:id error:", err);
    return res.status(500).json({ success: false, message: "Failed to update report." });
  }
});

/* ============================================================
   ADD COMMENT
============================================================ */
router.post("/:id/comments", async (req, res) => {
  try {
    const { text, by, sendEmail } = req.body;

    if (!text) {
      return res.status(400).json({ success: false, message: "Comment text is required." });
    }

    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ success: false, message: "Report not found." });
    }

    if (!Array.isArray(report.comments)) report.comments = [];
    report.comments.push({ text, by: by || "Admin", at: new Date() });

    if (!Array.isArray(report.history)) report.history = [];
    report.history.push({
      status: report.status,
      at:     new Date(),
      by:     by || "Admin",
      note:   `Comment added: ${text.substring(0, 100)}${text.length > 100 ? "..." : ""}`,
    });

    await report.save();

    if (sendEmail === true && report.email) {
      sendReportStatusEmail({
        to:       report.email,
        heading:  report.heading,
        status:   report.status,
        reportId: report.reportId || String(report._id),
        comment:  text,
      }).catch(err => console.error("[Backend] Email error:", err.message));
    }

    return res.json({ success: true, report });
  } catch (err) {
    console.error("POST comment error:", err);
    return res.status(500).json({ success: false, message: "Failed to add comment." });
  }
});

/* ============================================================
   FOLLOW UP
============================================================ */
router.post("/:id/followup", async (req, res) => {
  try {
    const report = await Report.findById(req.params.id).lean();
    if (!report) return res.status(404).json({ success: false, message: "Report not found." });

    const { email, by } = req.body;
    await Report.findByIdAndUpdate(req.params.id, {
      $push: {
        comments: {
          text: `🔔 Follow-up requested by reporter (${by || email || "unknown"}).`,
          at:   new Date(),
          by:   "System",
        },
      },
    });

    return res.json({ success: true, message: "Follow-up notification sent." });
  } catch (err) {
    console.error("POST /reports/:id/followup error:", err);
    return res.status(500).json({ success: false, message: "Failed to send follow-up." });
  }
});

/* ============================================================
   DELETE COMMENT
============================================================ */
router.delete("/:id/comments/:index", async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ success: false, message: "Report not found." });

    const idx = parseInt(req.params.index, 10);
    if (isNaN(idx) || idx < 0 || idx >= report.comments.length) {
      return res.status(400).json({ success: false, message: "Invalid comment index." });
    }

    report.comments.splice(idx, 1);
    await report.save();
    return res.json({ success: true, report });
  } catch (err) {
    console.error("DELETE comment error:", err);
    return res.status(500).json({ success: false, message: "Failed to delete comment." });
  }
});

/* ============================================================
   PURGE RESOLVED/ARCHIVED
============================================================ */
router.delete("/purge-resolved-archived", async (req, res) => {
  try {
    const result = await Report.deleteMany({ status: { $in: ["Resolved", "Archived"] } });
    return res.json({
      success:      true,
      deletedCount: result.deletedCount,
      message:      `Purged ${result.deletedCount} Resolved/Archived reports.`,
    });
  } catch (err) {
    console.error("DELETE /purge-resolved-archived error:", err);
    return res.status(500).json({ success: false, message: "Purge failed." });
  }
});

module.exports = router;