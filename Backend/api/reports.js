const express = require("express");
const router = express.Router();
 
const { authenticateToken, requireRole } = require("../middleware/auth");
const { validateReport, validateComment, handleValidationErrors } = require("../middleware/validation");
const { createReportLimiter, getReportsLimiter, addCommentLimiter, updateStatusLimiter } = require("../middleware/rateLimiter");
const { upload, validateAndProcessImage } = require("../middleware/imageUpload");
 
const Report = require("../models/Report");
const cloudinary = require("../config/cloudinary");
const { sendReportStatusEmail } = require("../utils/mailer");

/* ===============================
   UTILITY FUNCTIONS FOR REPORT ID
=============================== */

/**
 * Generates a report ID in format: DDMMYYXXX
 * DD = day, MM = month, YY = year (2-digit), XXX = 3-digit counter
 * Counter resets every day
 * Example: 020426001, 020426002, 030426001
 */
async function generateReportId() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = String(now.getFullYear()).slice(-2);
  
  const datePrefix = `${day}${month}${year}`;
  
  // Find the latest report created today
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  
  const latestReportToday = await Report.findOne({
    createdAt: {
      $gte: startOfDay,
      $lte: endOfDay,
    },
    reportId: {
      $regex: `^${datePrefix}`,
    },
  })
    .sort({ createdAt: -1 })
    .lean();
  
  // Extract counter from the last report ID, or start at 0
  let counter = 0;
  if (latestReportToday && latestReportToday.reportId) {
    const match = latestReportToday.reportId.match(/(\d{3})$/);
    if (match) {
      counter = parseInt(match[1], 10);
    }
  }
  
  // Increment and format the counter
  counter += 1;
  const counterStr = String(counter).padStart(3, "0");
  
  return `${datePrefix}${counterStr}`;
}
 
// ────────────────────────────────────────────────────────────────────
// GET ALL REPORTS - Only admins can see all
// ────────────────────────────────────────────────────────────────────
router.get(
  "/",
  getReportsLimiter,
  authenticateToken,
  requireRole("admin"),
  async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, parseInt(req.query.limit) || 20);
      const skip = (page - 1) * limit;
 
      const [reports, total] = await Promise.all([
        Report.find()
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Report.countDocuments(),
      ]);
 
      res.json({
        success: true,
        reports,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      console.error("GET /reports error:", err);
      res.status(500).json({
        success: false,
        message: "Failed to load reports",
      });
    }
  }
);
 
// ────────────────────────────────────────────────────────────────────
// CREATE REPORT - Any authenticated user
// ────────────────────────────────────────────────────────────────────
router.post(
  "/",
  createReportLimiter,
  authenticateToken,
  upload.single("ImageFile"),
  validateAndProcessImage,
  validateReport,
  handleValidationErrors,
  async (req, res) => {
    try {
      const {
        email,
        heading,
        description,
        concern,
        subConcern,
        building,
        college,
        userType,
        floor,
        room,
        otherConcern,
        otherBuilding,
        otherRoom,
      } = req.body;
 
      // Image was validated by middleware
      const uploaded = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { 
            folder: "bfmo_reports",
            resource_type: "image",
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        stream.end(req.file.buffer);
      });

      // Generate report ID
      const reportId = await generateReportId();
 
      const report = await Report.create({
        reportId,
        email,
        heading,
        description,
        concern,
        subConcern,
        building,
        college,
        userType: userType || "Student",
        floor,
        room,
        otherConcern,
        otherBuilding,
        otherRoom,
        ImageFile: uploaded.secure_url,
      });
 
      res.status(201).json({
        success: true,
        report,
      });
    } catch (err) {
      console.error("POST /reports error:", err);
      res.status(500).json({
        success: false,
        message: "Failed to create report",
      });
    }
  }
);
 
// ────────────────────────────────────────────────────────────────────
// UPDATE REPORT STATUS - Only admins
// ────────────────────────────────────────────────────────────────────
router.put(
  "/:id",
  updateStatusLimiter,
  authenticateToken,
  requireRole("admin"),
  async (req, res) => {
    try {
      const { status, comments, overwriteComments, comment } = req.body;
 
      const existing = await Report.findById(req.params.id);
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: "Report not found",
        });
      }
 
      const oldStatus = existing.status || "Pending";
 
      if (status && ["Pending", "Waiting for Materials", "In Progress", "Resolved", "Archived"].includes(status)) {
        existing.status = status;
      }
 
      if (overwriteComments && Array.isArray(comments)) {
        existing.comments = comments;
      }
 
      const updated = await existing.save();
 
      // Send email notification
      if (status && status !== oldStatus) {
        sendReportStatusEmail({
          to: updated.email,
          heading: updated.heading,
          status: updated.status,
          reportId: String(updated._id),
          comment: comment || "",
          adminName: req.user.email,
        }).catch((err) => {
          console.warn("Email notification failed:", err.message);
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
  }
);
 
// ────────────────────────────────────────────────────────────────────
// ADD COMMENT - Authenticated users (admins only)
// ────────────────────────────────────────────────────────────────────
router.post(
  "/:id/comments",
  addCommentLimiter,
  authenticateToken,
  requireRole("admin"),
  validateComment,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { text, by, skipEmail } = req.body;
 
      const newComment = {
        text: text.trim(),
        by: by || "Admin",
        at: new Date(),
      };
 
      const updated = await Report.findByIdAndUpdate(
        req.params.id,
        { $push: { comments: newComment } },
        { returnDocument: "after" }
      );
 
      if (!updated) {
        return res.status(404).json({
          success: false,
          message: "Report not found",
        });
      }
 
      // Notify user unless skipped
      if (!skipEmail) {
        sendCommentNotificationEmail({
          to: updated.email,
          reportId: String(updated._id),
          heading: updated.heading,
          commentText: newComment.text,
        }).catch((err) => {
          console.warn("Comment notification failed:", err.message);
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
  }
);
 
// ────────────────────────────────────────────────────────────────────
// DELETE COMMENT - Authenticated admins
// ────────────────────────────────────────────────────────────────────
router.delete(
  "/:id/comments/:index",
  authenticateToken,
  requireRole("admin"),
  async (req, res) => {
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
  }
);
 
module.exports = router;