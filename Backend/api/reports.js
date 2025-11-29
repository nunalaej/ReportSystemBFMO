const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");

const Report = require("../models/Report");

/* ============================================================
   IMAGE UPLOAD CONFIG (multer)
============================================================ */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "..", "uploads"));
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

/* ============================================================
   GET ALL REPORTS
============================================================ */
router.get("/", async (req, res) => {
  try {
    const reports = await Report.find().sort({ createdAt: -1 });
    res.json(reports);
  } catch (err) {
    console.error("GET /reports error:", err);
    res.status(500).json({ error: "Failed to load reports" });
  }
});

/* ============================================================
   GET ONE REPORT
============================================================ */
router.get("/:id", async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: "Report not found" });
    res.json(report);
  } catch (err) {
    console.error("GET /reports/:id error:", err);
    res.status(500).json({ error: "Failed to load report" });
  }
});

/* ============================================================
   CREATE REPORT
============================================================ */
router.post("/", upload.single("image"), async (req, res) => {
  try {
    const newReport = new Report({
      ...req.body,
      image: req.file ? `/uploads/${req.file.filename}` : "",
    });

    await newReport.save();
    res.json({ success: true, report: newReport });
  } catch (err) {
    console.error("POST /reports error:", err);
    res.status(500).json({ error: "Failed to create report" });
  }
});

/* ============================================================
   UPDATE REPORT (Status + Edit Comments)
============================================================ */
router.put("/:id", async (req, res) => {
  try {
    const { status, overwriteComments, comments } = req.body;
    const updateFields = {};

    if (status) updateFields.status = status;

    if (overwriteComments && Array.isArray(comments)) {
      updateFields.comments = comments; // front end provides full array
    }

    const updated = await Report.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: "Report not found" });

    res.json({ success: true, report: updated });
  } catch (err) {
    console.error("PUT /reports/:id error:", err);
    res.status(500).json({ error: "Failed to update report" });
  }
});

/* ============================================================
   ADD COMMENT
============================================================ */
router.post("/:id/comments", async (req, res) => {
  try {
    const { text, by } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Comment text required" });
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
      return res.status(404).json({ error: "Report not found" });
    }

    res.json({ success: true, report: updated });
  } catch (err) {
    console.error("POST /reports/:id/comments error:", err);
    res.status(500).json({ error: "Failed to add comment" });
  }
});

/* ============================================================
   DELETE COMMENT (by index)
============================================================ */
router.delete("/:id/comments/:index", async (req, res) => {
  try {
    const { id, index } = req.params;

    const report = await Report.findById(id);
    if (!report) return res.status(404).json({ error: "Report not found" });

    const idx = parseInt(index, 10);
    if (isNaN(idx) || idx < 0 || idx >= report.comments.length) {
      return res.status(400).json({ error: "Invalid comment index" });
    }

    report.comments.splice(idx, 1);
    await report.save();

    res.json({ success: true, report });
  } catch (err) {
    console.error("DELETE /reports/:id/comments/:index error:", err);
    res.status(500).json({ error: "Failed to delete comment" });
  }
});

/* ============================================================
   EXPORT ROUTER
============================================================ */
module.exports = router;
