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

// Subdocument schema for assigned staff
const AssignedStaffSchema = new mongoose.Schema(
  {
    staffId: { type: String, required: true },
    staffName: { type: String, default: "" },
    staffEmail: { type: String, default: "" },
    assignedAt: { type: Date, default: Date.now },
    assignedBy: { type: String, default: "System" },
    role: { type: String, default: "Assigned Staff" }, // e.g., "Lead", "Support", "Assigned Staff"
  },
  { _id: true } // Each assigned staff gets their own _id for tracking
);

const ReportSchema = new mongoose.Schema(
  {
    reportId: {
      type: String,
      unique: true,
      index: true,
      required: true,
    },

    email: String,
    heading: String,
    description: String,

    concern: String,
    subConcern: { type: String, default: "" },
    otherConcern: { type: String, default: "" },

    building: String,
    otherBuilding: { type: String, default: "" },

    userType: { type: String, enum: ["Student", "Staff/Faculty"], default: "Student" },

    college: { type: String, default: "Unspecified" },
    floor: { type: String, default: "" },
    room: { type: String, default: "" },
    otherRoom: { type: String, default: "" },

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

    ImageFile: { type: String, default: "" },

    // IMPORTANT: this must exist for $push to work
    comments: {
      type: [CommentSchema],
      default: [],
    },

    // NEW: Multi-staff assignment support
    assignedStaff: {
      type: [AssignedStaffSchema],
      default: [],
    },

    // Track who created/updated the report
    createdBy: { type: String, default: "Unknown" },
    updatedBy: { type: String, default: "System" },
  },
  {
    timestamps: true,
    collection: collectionName,
  }
);

// Indexes
ReportSchema.index({ email: 1 });
ReportSchema.index({ status: 1 });
ReportSchema.index({ building: 1 });
ReportSchema.index({ concern: 1 });
ReportSchema.index({ createdAt: -1 });
ReportSchema.index({ status: 1, createdAt: -1 }); // Compound index
ReportSchema.index({ building: 1, concern: 1 }); // For similarity
ReportSchema.index({ "assignedStaff.staffId": 1 }); // For querying by assigned staff
ReportSchema.index({ reportId: 1, "assignedStaff.staffId": 1 }); // Compound for staff reports

module.exports = mongoose.model("Report", ReportSchema);