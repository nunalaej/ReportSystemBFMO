const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema({
  id: { type: String },
  text: { type: String },
  done: { type: Boolean, default: false },
}, { _id: false });

const liststaskSchema = new mongoose.Schema({
  id: { type: String },
  name: { type: String },
  concernType: { type: String },
  reportId: { type: String },
  assignedStaff: { type: [String], default: [] },
  status: { type: String, default: "Pending" },
  checklist: { type: [taskSchema], default: [] },
  userId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Liststask", liststaskSchema);