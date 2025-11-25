// lib/models/report.ts
import { Schema, model, models } from "mongoose";

const CommentSchema = new Schema(
  {
    text: { type: String, required: true },
    at: { type: Date, default: Date.now },
    by: { type: String, default: "System" },
  },
  { _id: false }
);

const ReportSchema = new Schema(
  {
    heading: String,
    description: String,

    // Concern details
    concern: String,
    subConcern: String,
    otherConcern: String,

    // Location details
    building: String,
    otherBuilding: String,
    college: { type: String, default: "Unspecified" },
    room: { type: String, default: "" },
    otherRoom: String,

    status: {
      type: String,
      default: "Pending",
      enum: ["Pending", "In Progress", "Resolved", "Archived"],
    },
    image: String,
    comments: { type: [CommentSchema], default: [] },
    createdAt: { type: Date, default: Date.now },
    email: String,
  },
  { timestamps: true }
);

export const Report = models.Report || model("Report", ReportSchema);
