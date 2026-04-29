// routes/documents.js
const express    = require("express");
const router     = express.Router();
const multer     = require("multer");
const cloudinary = require("cloudinary").v2;
const Document   = require("../models/Documents");

/* ── Multer: memory storage, PDF only, max 20 MB ── */
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF files are allowed."));
  },
});

/* ── Upload PDF buffer → Cloudinary ── */
const uploadPdfToCloudinary = (buffer, originalName) =>
  new Promise((resolve, reject) => {
    const cleanName = originalName
      .replace(/\.pdf$/i, "")
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .slice(0, 60);

    cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        folder:        "bfmo-docs",
        public_id:     `${Date.now()}-${cleanName}`,
        format:        "pdf",
      },
      (err, result) => { if (err) reject(err); else resolve(result); }
    ).end(buffer);
  });

/* ── GET /api/documents  — ?all=1 for admin, omit for students (published only) ── */
router.get("/", async (req, res) => {
  try {
    const filter = req.query.all === "1" ? {} : { published: true };
    const docs   = await Document.find(filter).sort({ pinned: -1, createdAt: -1 });
    res.json({ success: true, documents: docs });
  } catch (err) {
    console.error("[documents GET /]", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ── GET /api/documents/:id ── */
router.get("/:id", async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: "Document not found." });
    res.json({ success: true, document: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ── POST /api/documents  — multipart, field name: "pdf" ── */
router.post("/", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "PDF file is required." });
    const { title, description, category, published, pinned, uploadedBy } = req.body;
    if (!title?.trim()) return res.status(400).json({ success: false, message: "Title is required." });

    const result = await uploadPdfToCloudinary(req.file.buffer, req.file.originalname);

    const doc = await Document.create({
      title:       title.trim(),
      description: description?.trim() || "",
      category:    category?.trim()    || "General",
      fileUrl:     result.secure_url,
      fileName:    req.file.originalname,
      fileSize:    req.file.size,
      publicId:    result.public_id,
      published:   published !== "false",
      pinned:      pinned    === "true",
      uploadedBy:  uploadedBy?.trim() || "Admin",
    });

    console.log(`[documents] Uploaded: "${doc.title}" → ${doc.fileUrl}`);
    res.status(201).json({ success: true, document: doc });
  } catch (err) {
    console.error("[documents POST /]", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ── PUT /api/documents/:id  — metadata only, no file replacement ── */
router.put("/:id", async (req, res) => {
  try {
    const { title, description, category, published, pinned } = req.body;
    const updates = {};
    if (title       !== undefined) updates.title       = String(title).trim();
    if (description !== undefined) updates.description = String(description).trim();
    if (category    !== undefined) updates.category    = String(category).trim();
    if (published   !== undefined) updates.published   = published === true || published === "true";
    if (pinned      !== undefined) updates.pinned      = pinned    === true || pinned    === "true";

    const doc = await Document.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!doc) return res.status(404).json({ success: false, message: "Document not found." });
    res.json({ success: true, document: doc });
  } catch (err) {
    console.error("[documents PUT /:id]", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ── DELETE /api/documents/:id  — removes from DB + Cloudinary ── */
router.delete("/:id", async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: "Document not found." });

    if (doc.publicId) {
      try {
        await cloudinary.uploader.destroy(doc.publicId, { resource_type: "raw" });
      } catch (cdnErr) {
        console.warn(`[documents] Cloudinary delete warn: ${cdnErr.message}`);
      }
    }

    await doc.deleteOne();
    res.json({ success: true, message: "Document deleted." });
  } catch (err) {
    console.error("[documents DELETE /:id]", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;