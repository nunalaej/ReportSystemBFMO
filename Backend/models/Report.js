const mongoose = require("mongoose");

const CommentSchema = new mongoose.Schema({
  text:     { type: String },
  comment:  { type: String },
  by:       { type: String },
  at:       { type: Date, default: Date.now },
  imageUrl: { type: String },
});

const HistoryEntrySchema = new mongoose.Schema({
  status: { type: String },
  at:     { type: Date, default: Date.now },
  by:     { type: String },
  note:   { type: String },
});

const ReportSchema = new mongoose.Schema(
  {
    reportId:      { type: String },
    email:         { type: String },
    userType:      { type: String },
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
    image:         { type: String },
    ImageFile:     { type: String },
    status:        { type: String, default: "Pending" },
    comments:      [CommentSchema],
    history:       [HistoryEntrySchema],
  },
  {
    timestamps: true,
    // ✅ This tells Mongoose which collection to use
    // Change "reports" to whatever your actual MongoDB collection is named
    collection: "reports",
  }
);

// ✅ Delete cached model to avoid stale schema issues
delete mongoose.connection.models["Report"];
module.exports = mongoose.model("Report", ReportSchema);