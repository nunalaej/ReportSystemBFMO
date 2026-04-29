// models/Document.js
// ─── Separate collection for BFMO public documents (PDF files) ──────────────
const mongoose = require("mongoose");

const COLLECTION = process.env.MONGODB_DOCUMENTS_COLLECTION || "DocumentsCollection";

if (mongoose.models["Document"]) delete mongoose.models["Document"];

const DocumentSchema = new mongoose.Schema(
  {
    /* ── Identity ── */
    title:       { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    category:    { type: String, default: "General", trim: true },  // e.g. "Forms", "Guidelines", "Policies"

    /* ── File ── */
    fileUrl:     { type: String, required: true, trim: true },  // Cloudinary URL or static path
    fileName:    { type: String, default: "", trim: true },     // original file name
    fileSize:    { type: Number, default: 0 },                  // bytes
    publicId:    { type: String, default: "", trim: true },     // Cloudinary public_id for deletion

    /* ── Visibility ── */
    published:   { type: Boolean, default: true },   // false = draft, hidden from students
    pinned:      { type: Boolean, default: false },  // pinned docs appear at top

    /* ── Audit ── */
    uploadedBy:  { type: String, default: "Admin", trim: true },
  },
  {
    timestamps: true,       // createdAt + updatedAt
    collection: COLLECTION,
  }
);

// Index for fast category + published queries
DocumentSchema.index({ category: 1, published: 1 });
DocumentSchema.index({ pinned: -1, createdAt: -1 });

module.exports = mongoose.model("Document", DocumentSchema);