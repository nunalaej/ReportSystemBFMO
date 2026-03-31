// models/Report.js  (UPDATED)
// Changes from original:
//   • reportId  – human-readable ddmmyyyy + 3-digit sequence, auto-generated on save
//   • reporterType – "Student" | "Staff/Faculty"

const mongoose = require("mongoose");

/* ============================================================
   HELPERS
============================================================ */

/**
 * Returns today's date prefix in ddmmyyyy format.
 * Example: March 31 2026 → "31032026"
 */
function todayPrefix() {
  const now = new Date();
  const dd   = String(now.getDate()).padStart(2, "0");
  const mm   = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = String(now.getFullYear());
  return `${dd}${mm}${yyyy}`;
}

/* ============================================================
   SCHEMA
============================================================ */

const commentSchema = new mongoose.Schema(
  {
    text:     { type: String },
    comment:  { type: String },
    at:       { type: Date, default: Date.now },
    by:       { type: String, default: "Admin" },
    imageUrl: { type: String },
  },
  { _id: false }
);

const reportSchema = new mongoose.Schema(
  {
    // Human-readable ID – generated automatically before first save
    reportId: {
      type:   String,
      unique: true,
      sparse: true,   // allows null during the pre-save hook window
      index:  true,
    },

    email:         { type: String },
    heading:       { type: String },
    description:   { type: String },
    concern:       { type: String },
    subConcern:    { type: String },
    otherConcern:  { type: String },
    building:      { type: String },
    otherBuilding: { type: String },
    college:       { type: String },
    floor:         { type: String },
    room:          { type: String },
    otherRoom:     { type: String },

    // Image stored as Cloudinary secure_url
    image:     { type: String },
    ImageFile: { type: String },

    status: {
      type:    String,
      enum:    ["Pending", "Waiting for Materials", "In Progress", "Resolved", "Archived"],
      default: "Pending",
    },

    // NEW: who submitted the report
    reporterType: {
      type:    String,
      enum:    ["Student", "Staff/Faculty"],
      default: "Student",
    },

    comments: { type: [commentSchema], default: [] },
  },
  { timestamps: true }
);

/* ============================================================
   PRE-SAVE HOOK – auto-generate reportId
============================================================ */

reportSchema.pre("save", async function (next) {
  // Only generate on first insert
  if (this.reportId) return next();

  const prefix = todayPrefix();

  try {
    // Find the highest sequence used today
    // reportId format: ddmmyyyy + 3-digit sequence  → first 8 chars = prefix
    const lastToday = await this.constructor
      .findOne({ reportId: new RegExp(`^${prefix}`) })
      .sort({ reportId: -1 })
      .select("reportId")
      .lean();

    let seq = 1;
    if (lastToday && lastToday.reportId) {
      const lastSeq = parseInt(lastToday.reportId.slice(8), 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    // Cap at 999 per day (extremely unlikely to hit in practice)
    if (seq > 999) seq = 999;

    this.reportId = `${prefix}${String(seq).padStart(3, "0")}`;
  } catch (err) {
    // Non-fatal – leave reportId empty rather than crash
    console.error("reportId generation error:", err);
  }

  next();
});

/* ============================================================
   INDEXES
============================================================ */

reportSchema.index({ status:       1 });
reportSchema.index({ building:     1 });
reportSchema.index({ concern:      1 });
reportSchema.index({ college:      1 });
reportSchema.index({ reporterType: 1 });
reportSchema.index({ createdAt:    -1 });

module.exports = mongoose.model("Report", reportSchema);