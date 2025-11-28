// Backend/models/Report.js
const mongoose = require("mongoose");

const collectionName = process.env.MONGODB_COLLECTION || "ReportCollection";

// Subdocument schema for comments
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

    image: { type: String, default: "" },

    status: {
      type: String,
      default: "Pending",
      // include all statuses used in your frontend:
      enum: [
        "Pending",
        "Waiting for Materials",
        "In Progress",
        "Resolved",
        "Archived",
      ],
    },

    // ADD THIS: list of comments
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
