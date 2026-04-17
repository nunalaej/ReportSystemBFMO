const mongoose = require("mongoose");

/* ── Subdocuments ─────────────────────────────────────────── */
const ChecklistItemSchema = new mongoose.Schema(
  {
    id:   { type: String },
    text: { type: String, required: true },
    done: { type: Boolean, default: false },
  },
  { _id: false }
);

const CommentSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    by:   { type: String, default: "Staff" },
    at:   { type: Date,   default: Date.now },
  },
  { _id: false }
);

/* ── Main schema ──────────────────────────────────────────── */
const ListsTaskSchema = new mongoose.Schema(
  {
    userId:        { type: String,  default: "admin" },
    name:          { type: String,  required: true },
    concernType:   { type: String,  default: "Other" },
    reportId:      { type: String,  default: null },
    assignedStaff: { type: [String], default: [] },

    /**
     * Valid statuses (kept in sync with Meta statuses):
     *   Pending | Pending Inspect | In Progress | Resolved | Archived | Unfinished
     * "Unfinished" is set automatically by the notification job when a task
     * exceeds its priority's maximum duration without being resolved.
     */
    status:    { type: String, default: "Pending" },
    checklist: { type: [ChecklistItemSchema], default: [] },
    priority:  { type: String, default: "" },
    notes:     { type: String, default: "" },
    createdBy: { type: String, default: "Admin" },
    comments:  { type: [CommentSchema], default: [] },

    /**
     * Due date is auto-calculated from priority when a task is created
     * (unless explicitly supplied). Priority → max days:
     *   Urgent → 1 day | High → 7 days | Medium → 30 days | Low → 90 days
     */
    dueDate: { type: Date, default: null },

    /** Timestamp of the last notification email sent for this task. */
    lastNotifiedAt: { type: Date, default: null },

    /** Timestamp when the task was escalated to "Unfinished". */
    escalatedAt: { type: Date, default: null },

    /** Running count of notification emails sent. */
    notificationsSent: { type: Number, default: 0 },

    /**
     * True once the task has been automatically escalated to "Unfinished"
     * by the notification job.  Cleared when the task is resolved/archived.
     */
    isEscalated: { type: Boolean, default: false },
  },
  { timestamps: true }
);

/* ── Indexes ─────────────────────────────────────────────── */
ListsTaskSchema.index({ status:   1 });
ListsTaskSchema.index({ priority: 1 });
ListsTaskSchema.index({ reportId: 1 });
ListsTaskSchema.index({ dueDate:  1 });

module.exports =
  mongoose.models.ListsTask ||
  mongoose.model("ListsTask", ListsTaskSchema);