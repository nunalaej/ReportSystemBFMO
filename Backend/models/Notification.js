// models/Notification.js
const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: [
      "task_created", "task_updated", "task_status_changed",
      "task_deleted", "task_assigned", "task_escalated",
      "task_completed", "report_updated", "report_archived",
      "comment_added", "system",
      // ── Student-initiated ──
      "student_followup",
    ],
    default: "system"
  },
  title:      { type: String, required: true },
  message:    { type: String, required: true },
  taskId:     { type: String },
  taskName:   { type: String },
  reportId:   { type: String },
  changedBy:  { type: String },
  changedByRole: { type: String },
  fromValue:  { type: String },
  toValue:    { type: String },
  affectedStaff: [{ type: String }],
  read:       { type: Boolean, default: false },
  readBy:     [{ type: String }],
  emailSent:  { type: Boolean, default: false },
  emailCount: { type: Number,  default: 0 },
  meta:       { type: mongoose.Schema.Types.Mixed },
}, {
  timestamps:  true,
  collection: "notifications",
});

module.exports = mongoose.model("Notification", NotificationSchema);