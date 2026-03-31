// Backend/models/Report.js
const mongoose = require("mongoose");

const collectionName = process.env.MONGODB_COLLECTION || "ReportCollection";

// Subdocument schema for each comment
const CommentSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    at: { type: Date, default: Date.now },
    by: { type: String, default: "System" },
  },
  { _id: false } // no separate _id for each comment
);

const ReportSchema = new mongoose.Schema(
  {
    email: String,
    heading: String,
    description: String,

    concern: String,
    subConcern: { type: String, default: "" },
    otherConcern: { type: String, default: "" },

    building: String,
    otherBuilding: { type: String, default: "" },

    college: { type: String, default: "Unspecified" },
    floor: { type: String, default: "" },
    room: { type: String, default: "" },
    otherRoom: { type: String, default: "" },
    status: {
      type: String,
      default: "Pending",
      enum: [
        "Pending",
        "Waiting for Materials", // used by frontend
        "In Progress",
        "Resolved",
        "Archived",
      ],
    },

    ImageFile: { type: String, default: "" },

    // IMPORTANT: this must exist for $push to work
    comments: {
      type: [CommentSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: collectionName,
  }
);

module.exports = mongoose.model("Report", ReportSchema);
