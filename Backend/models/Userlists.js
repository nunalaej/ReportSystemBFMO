const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    id: String,
    text: String,
    done: { type: Boolean, default: false },
  },
  { _id: false }
);

const assignmentSchema = new mongoose.Schema(
  {
    id: String,
    name: String,
    concernType: {
      type: String,
      enum: ["Mechanical", "Civil", "Electrical", "Safety Hazard", "Other"],
      default: "Mechanical",
    },
    reportId: String,
    assignedStaff: { type: [String], default: [] },
    status: {
      type: String,
      enum: ["Pending", "Waiting for Materials", "In Progress", "Resolved"],
      default: "Pending",
    },
    checklist: { type: [taskSchema], default: [] },
  },
  { _id: false }
);

const listSchema = new mongoose.Schema(
  {
    id: String,
    title: String,
    collapsed: { type: Boolean, default: false },
    tasks: { type: [taskSchema], default: [] },
    assignments: { type: [assignmentSchema], default: [] },
  },
  { _id: false }
);

const userListsSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    lists: { type: [listSchema], default: [] },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

module.exports = mongoose.model("UserLists", userListsSchema);