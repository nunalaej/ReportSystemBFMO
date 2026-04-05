const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema({
  id: String,
  text: String,
  done: { type: Boolean, default: false },
}, { _id: false });

const liststaskSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  id: String,
  name: String,
  concernType: String,
  reportId: String,
  assignedStaff: { type: [String], default: [] },
  status: { type: String, default: "Pending" },
  checklist: { type: [taskSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Liststask", liststaskSchema);