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

/* ── Report ID Generator: DDMMYYNNN ── */
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

    const reportId = await generateReportId();

    // ✅ Accept any status string — no hardcoded enum
    const startingStatus = inheritedStatus || "Pending";

    const report = await Report.create({
      reportId, email, heading, description,
      concern, subConcern, building, college,
      floor, room, otherConcern, otherBuilding,
      otherRoom, userType,
      ImageFile: uploaded.secure_url,
      status: startingStatus,
    });

    return res.status(201).json({ success: true, report });
  } catch (err) {
    console.error("POST /reports error:", err);
    return res.status(500).json({ success: false, message: "Failed to create report." });
  }
});

/* ============================================================
   UPDATE REPORT
============================================================ */
router.put("/:id", async (req, res) => {
  try {
    const { status, overwriteComments, comments, comment } = req.body;

    const existing = await Report.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Report not found." });

    const oldStatus = existing.status || "Pending";

    if (status !== undefined)                          existing.status   = status;
    if (overwriteComments && Array.isArray(comments))  existing.comments = comments;

    const updated = await existing.save();

    if (status && status !== oldStatus) {
      sendReportStatusEmail({
        to:       updated.email,
        heading:  updated.heading,
        status:   updated.status,
        reportId: String(updated._id),
        comment:  comment || "",
      }).catch(err => console.error("Email send failed:", err));
    }

    return res.json({ success: true, report: updated });
  } catch (err) {
    console.error("PUT /reports/:id error:", err);
    return res.status(500).json({ success: false, message: "Failed to update report." });
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
   ADD COMMENT
============================================================ */
router.post("/:id/comments", async (req, res) => {
  try {
    const { text, by } = req.body;
    if (!text) return res.status(400).json({ success: false, message: "Comment text is required." });

    const updated = await Report.findByIdAndUpdate(
      req.params.id,
      { $push: { comments: { text, by: by || "Admin", at: new Date() } } },
      { new: true }
    );

    if (!updated) return res.status(404).json({ success: false, message: "Report not found." });
    return res.json({ success: true, report: updated });
  } catch (err) {
    console.error("POST comment error:", err);
    return res.status(500).json({ success: false, message: "Failed to add comment." });
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
   PURGE RESOLVED/ARCHIVED HELLO?
============================================================ */
router.delete("/purge-resolved-archived", async (req, res) => {
  try {
    const result = await Report.deleteMany({ status: { $in: ["Resolved", "Archived"] } });
    return res.json({
      success: true,
      deletedCount: result.deletedCount,
      message: `Purged ${result.deletedCount} Resolved/Archived reports.`,
    });
  } catch (err) {
    console.error("DELETE /purge-resolved-archived error:", err);
    return res.status(500).json({ success: false, message: "Purge failed." });
  }
});

module.exports = router;