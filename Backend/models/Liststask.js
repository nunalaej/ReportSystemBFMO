// models/ListsTask.js
const mongoose = require("mongoose");

const collectionName = process.env.MONGODB_COLLECTION_LISTSTASK || "ListsTaskCollection";

// Subdocument for checklist items
const ChecklistItemSchema = new mongoose.Schema(
  {
    id: { type: String, default: () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8) },
    text: { type: String, required: true },
    done: { type: Boolean, default: false },
  },
  { _id: true }
);

// Subdocument for assigned staff
const AssignedStaffSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, default: "" },
    role: { type: String, default: "Staff" },
  },
  { _id: false }
);

const ListsTaskSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },

    // Task metadata
    name: {
      type: String,
      required: true,
      trim: true,
    },

    concernType: {
      type: String,
      enum: ["Mechanical", "Civil", "Electrical", "Safety Hazard", "Other"],
      default: "Mechanical",
    },

    // Link to Report if applicable
    reportId: {
      type: String,
      default: null,
      index: true,
    },

    // Task status
    status: {
      type: String,
      enum: ["Pending", "Waiting for Materials", "In Progress", "Resolved"],
      default: "Pending",
    },

    // Assigned staff
    assignedStaff: {
      type: [String], // Array of staff names/IDs
      default: [],
    },

    // Checklist
    checklist: {
      type: [ChecklistItemSchema],
      default: [],
    },

    // Metadata
    createdBy: { type: String, default: "System" },
    updatedBy: { type: String, default: "System" },
    notes: { type: String, default: "" },
  },
  {
    timestamps: true,
    collection: collectionName,
  }
);

// Indexes
ListsTaskSchema.index({ userId: 1 });
ListsTaskSchema.index({ userId: 1, status: 1 });
ListsTaskSchema.index({ reportId: 1 });
ListsTaskSchema.index({ createdAt: -1 });
ListsTaskSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("ListsTask", ListsTaskSchema);