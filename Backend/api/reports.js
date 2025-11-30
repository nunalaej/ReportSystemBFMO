// routes/reports.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");

const Report = require("../models/Report");
const cloudinary = require("../config/cloudinary"); // <--- import cloudinary

/* ============================================================
   IMAGE UPLOAD CONFIG (multer, memory storage for Cloudinary)
============================================================ */
const upload = multer({ storage: multer.memoryStorage() });

/* ============================================================
   GET ALL REPORTS
   /api/reports
============================================================ */
router.get("/", async (req, res) => {
  try {
    const reports = await Report.find().sort({ createdAt: -1 });
    // front end can handle both plain array or {reports}, but let's be explicit
    res.json({ success: true, reports });
  } catch (err) {
    console.error("GET /reports error:", err);
    res.status(500).json({ success: false, message: "Failed to load reports" });
  }
});

/* ============================================================
   GET ONE REPORT
   /api/reports/:id
============================================================ */
router.get("/:id", async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
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
   /api/reports  (POST)
============================================================ */
router.post("/", upload.single("imageFile"), async (req, res) => {
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

    let imageURL = ""; // <-- match the schema field name

    // If there is an attached file, upload it to Cloudinary
    if (req.file) {
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

      imageURL = uploaded.secure_url;
    }

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
      imageURL, // <-- save here
    });

    return res.status(201).json({
      success: true,
      report,
    });
  } catch (err) {
    console.error("Error creating report:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to create report.",
    });
  }
});

/* ============================================================
   UPDATE REPORT (Status + Edit Comments)
   /api/reports/:id  (PUT)
============================================================ */
router.put("/:id", async (req, res) => {
  try {
    const { status, overwriteComments, comments } = req.body;
    const updateFields = {};

    if (status) updateFields.status = status;

    if (overwriteComments && Array.isArray(comments)) {
      updateFields.comments = comments;
    }

    const updated = await Report.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }

    res.json({ success: true, report: updated });
  } catch (err) {
    console.error("PUT /reports/:id error:", err);
    res.status(500).json({ success: false, message: "Failed to update report" });
  }
});

/* ============================================================
   ADD COMMENT
   /api/reports/:id/comments  (POST)
============================================================ */
router.post("/:id/comments", async (req, res) => {
  try {
    const { text, by } = req.body;
    if (!text) {
      return res.status(400).json({ success: false, message: "Comment text required" });
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
      return res.status(404).json({ success: false, message: "Report not found" });
    }

    res.json({ success: true, report: updated });
  } catch (err) {
    console.error("POST /reports/:id/comments error:", err);
    res.status(500).json({ success: false, message: "Failed to add comment" });
  }
});

/* ============================================================
   DELETE COMMENT (by index)
   /api/reports/:id/comments/:index  (DELETE)
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
    console.error("DELETE /reports/:id/comments/:index error:", err);
    res.status(500).json({ success: false, message: "Failed to delete comment" });
  }
});

/* ============================================================
   EXPORT ROUTER
============================================================ */
module.exports = router;
