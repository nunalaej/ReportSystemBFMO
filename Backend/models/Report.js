// Backend/models/Report.js
import mongoose from "mongoose";

const CommentSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    at: { type: Date, default: Date.now },
    by: { type: String, default: "System" },
  },
  { _id: false }
);

const ReportSchema = new mongoose.Schema(
  {
    heading: String,
    description: String,

    concern: String,
    subConcern: String,
    otherConcern: String,

    building: String,
    otherBuilding: String,

    college: { type: String, default: "Unspecified" },
    floor: String,
    room: { type: String, default: "" },
    otherRoom: String,

    status: {
      type: String,
      default: "Pending",
      enum: [
        "Pending",
        "Waiting for Materials",
        "In Progress",
        "Resolved",
        "Archived",
      ],
    },

    image: String, // Cloudinary URL or /uploads/filename

    comments: { type: [CommentSchema], default: [] },

    createdAt: { type: Date, default: Date.now },
    email: String,
  },
  { timestamps: true }
);

export const Report =
  mongoose.models.Report || mongoose.model("Report", ReportSchema);
