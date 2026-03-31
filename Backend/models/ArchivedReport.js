// models/ArchivedReport.js
// Stores reports that were deleted from the main collection on July 30 cleanup.
// These records are kept ONLY for analytics purposes and are never shown in the
// active reports list.

const mongoose = require("mongoose");

const archivedReportSchema = new mongoose.Schema(
  {
    // Copy of all original Report fields
    originalId: { type: String, required: true }, // original Report._id as string
    reportId: { type: String },                   // human-readable ID e.g. 310326001
    email: { type: String },
    heading: { type: String },
    description: { type: String },
    concern: { type: String },
    subConcern: { type: String },
    otherConcern: { type: String },
    building: { type: String },
    otherBuilding: { type: String },
    college: { type: String },
    floor: { type: String },
    room: { type: String },
    otherRoom: { type: String },
    image: { type: String },
    ImageFile: { type: String },
    status: { type: String },
    reporterType: { type: String, default: "Student" }, // Student | Staff/Faculty
    comments: { type: Array, default: [] },
    createdAt: { type: Date },  // original creation date from Report

    // Cleanup metadata
    purgedAt: { type: Date, default: Date.now },  // date this was moved here
    purgeYear: { type: Number },                   // which annual purge cycle
  },
  {
    // Don't add automatic timestamps – we manage them manually
    timestamps: false,
    collection: "archived_reports",
  }
);

// Index for fast analytics queries
archivedReportSchema.index({ concern: 1 });
archivedReportSchema.index({ building: 1 });
archivedReportSchema.index({ status: 1 });
archivedReportSchema.index({ createdAt: 1 });
archivedReportSchema.index({ purgeYear: 1 });
archivedReportSchema.index({ reporterType: 1 });

module.exports = mongoose.model("ArchivedReport", archivedReportSchema);