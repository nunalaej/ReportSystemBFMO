// Backend/api/reports.js
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Report = require("../models/Report");
const cloudinary = require("cloudinary").v2;

const router = express.Router();

/* ---------- Cloudinary config ---------- */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* ---------- Multer: store file in memory ---------- */
const upload = multer({ storage: multer.memoryStorage() });

/* ---------- GET /api/reports ---------- */
router.get("/", async (req, res) => {
  try {
    const reports = await Report.find().sort({ createdAt: -1 }).lean();
    res.json({ success: true, reports });
  } catch (err) {
    console.error("Error fetching reports:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to load reports" });
  }
});

/* ---------- POST /api/reports ---------- */
router.post("/", upload.single("imageFile"), async (req, res) => {
  try {
    const body = req.body;

    let imageUrl = "";

    if (req.file) {
      // convert buffer to base64 data-uri
      const fileStr = `data:${req.file.mimetype};base64,${req.file.buffer.toString(
        "base64"
      )}`;

      const uploadResult = await cloudinary.uploader.upload(fileStr, {
        folder: "bfmo-reports", // optional folder name in Cloudinary
      });

      imageUrl = uploadResult.secure_url; // https://res.cloudinary.com/...
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
      image: imageUrl, // store Cloudinary URL here
      status: "Pending",
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

module.exports = router;
