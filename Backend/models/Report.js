const mongoose = require("mongoose");

if (mongoose.connection.models["Report"]) {
  delete mongoose.connection.models["Report"];
}
if (mongoose.models["Report"]) {
  delete mongoose.models["Report"];
}

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
    status:        { type: String, default: "Pending" }, // ✅ NO enum
    comments:      [CommentSchema],
    history:       [HistoryEntrySchema],
  },
  {
    timestamps: true,
    collection: "ReportCollection", // ✅ FIXED — matches your actual MongoDB collection name
    strict:     false,
  }
);

module.exports = mongoose.model("Report", ReportSchema);