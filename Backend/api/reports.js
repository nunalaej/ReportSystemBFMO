// Backend/api/reports.js
const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const Report = require("../models/Report");

const router = express.Router();

// Ensure uploads dir exists
const uploadDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname || "");
    const base = path.basename(file.originalname || "image", ext);
    const safeBase = base.replace(/[^a-z0-9_-]/gi, "_");
    cb(null, `${safeBase}-${Date.now()}${ext}`);
  },
});

const upload = multer({ storage });

/* ===========================
   GET /api/reports
   List all reports
=========================== */
router.get("/", async (req, res) => {
  try {
    const reports = await Report.find().sort({ createdAt: -1 }).lean();
    res.json({ success: true, reports });
  } catch (err) {
    console.error("Error fetching reports:", err);
    res.status(500).json({
      success: false,
      message: "Failed to load reports",
      error: err.message,
    });
  }
});

/* ===========================
   POST /api/reports
   Create new report
=========================== */
router.post("/", upload.single("imageFile"), async (req, res) => {
  try {
    const body = req.body;

    let imagePath = "";
    if (req.file) {
      imagePath = `/uploads/${req.file.filename}`;
    }

    const report = await Report.create({
      email: body.email,
      heading: body.heading,
      description: body.description,
      concern: body.concern,
      subConcern: body.subConcern || "",
      otherConcern: body.otherConcern || "",
      building: body.building,
      otherBuilding: body.otherBuilding || "",
      college: body.college || "Unspecified",
      floor: body.floor || "",
      room: body.room || "",
      otherRoom: body.otherRoom || "",
      image: imagePath,
      status: "Pending",
      comments: [],          // make sure this exists
    });

    res.json({
      success: true,
      message: "Report submitted successfully.",
      report,
    });
  } catch (err) {
    console.error("Error creating report:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to submit report" });
  }
});

/* ===========================
   PUT /api/reports/:id
   Update status and optionally add comment
=========================== */
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, comment, by } = req.body;

    if (!status && !comment) {
      return res.status(400).json({
        success: false,
        message: "Nothing to update.",
      });
    }

    // Build update object
    const update = {};

    if (status) {
      update.status = status;
    }

    if (comment && comment.trim()) {
      update.$push = {
        comments: {
          text: comment.trim(),
          by: by || "Admin",
          at: new Date(),
        },
      };
    }

    const updatedReport = await Report.findByIdAndUpdate(id, update, {
      new: true,
    });

    if (!updatedReport) {
      return res
        .status(404)
        .json({ success: false, message: "Report not found" });
    }

    res.json({
      success: true,
      message: "Report updated successfully",
      report: updatedReport,
    });
  } catch (err) {
    console.error("Error updating report:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to update report" });
  }
});

module.exports = router;
