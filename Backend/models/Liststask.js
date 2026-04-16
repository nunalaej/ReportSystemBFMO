const mongoose = require("mongoose");

const ChecklistItemSchema = new mongoose.Schema({
  id:   { type: String },
  text: { type: String, required: true },
  done: { type: Boolean, default: false },
});

const ListsTaskSchema = new mongoose.Schema(
  {
    userId:        { type: String, default: "admin" },
    name:          { type: String, required: true },
    concernType:   { type: String, default: "Other" },
    reportId:      { type: String, default: null },
    assignedStaff: { type: [String], default: [] },
    // ✅ No enum — accepts any status from meta config
    status:        { type: String, default: "Pending" },
    checklist:     { type: [ChecklistItemSchema], default: [] },
    priority:      { type: String, default: "" },
    notes:         { type: String, default: "" },
    createdBy:     { type: String, default: "Admin" },
  },
  { timestamps: true }
);

module.exports = mongoose.models.ListsTask || mongoose.model("ListsTask", ListsTaskSchema);