const express   = require("express");
const router    = express.Router();
const ListsTask = require("../models/Liststask");
const Report    = require("../models/Report");

/* ─────────────────────────────────────────────────────────────
   PRIORITY → DUE DATE
   Called on task creation (or when priority changes and no
   explicit dueDate was supplied by the caller).
───────────────────────────────────────────────────────────── */
const PRIORITY_MAX_DAYS = {
  Urgent: 1,
  High:   7,
  Medium: 30,
  Low:    90,
};

function calcDueDate(priority) {
  const days = PRIORITY_MAX_DAYS[priority];
  if (!days) return null;
  const due = new Date();
  due.setDate(due.getDate() + days);
  return due;
}

/* ─────────────────────────────────────────────────────────────
   GET /api/tasks
   Returns all tasks sorted newest-first.
───────────────────────────────────────────────────────────── */
router.get("/", async (req, res) => {
  try {
    const tasks = await ListsTask.find({}).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, tasks });
  } catch (err) {
    console.error("GET /tasks:", err);
    return res.status(500).json({ success: false, message: "Failed to load tasks." });
  }
});

/* ─────────────────────────────────────────────────────────────
   GET /api/tasks/:id
───────────────────────────────────────────────────────────── */
router.get("/:id", async (req, res) => {
  try {
    const task = await ListsTask.findById(req.params.id).lean();
    if (!task) return res.status(404).json({ success: false, message: "Task not found." });
    return res.json({ success: true, task });
  } catch (err) {
    console.error("GET /tasks/:id:", err);
    return res.status(500).json({ success: false, message: "Failed to load task." });
  }
});

/* ─────────────────────────────────────────────────────────────
   POST /api/tasks
   Creates a new task.  Due date is auto-calculated from
   priority unless the caller supplies one explicitly.
───────────────────────────────────────────────────────────── */
router.post("/", async (req, res) => {
  try {
    const {
      userId, name, concernType, reportId,
      assignedStaff, status, checklist,
      priority, notes, createdBy, dueDate,
    } = req.body;

    if (!name?.trim())
      return res.status(400).json({ success: false, message: "Task name is required." });

    if (reportId) {
      const existing = await ListsTask.findOne({ reportId });
      if (existing)
        return res.status(409).json({
          success: false,
          message: `A task for report #${reportId} already exists.`,
        });
    }

    // Honour an explicit dueDate; otherwise derive from priority.
    const resolvedDueDate =
      dueDate ? new Date(dueDate) : calcDueDate(priority || "");

    const newTask = await ListsTask.create({
      userId:        userId        || "admin",
      name:          name.trim(),
      concernType:   concernType   || "Other",
      reportId:      reportId      || null,
      assignedStaff: Array.isArray(assignedStaff) ? assignedStaff : [],
      status:        status        || "Pending",
      checklist:     Array.isArray(checklist) ? checklist : [],
      priority:      priority      || "",
      notes:         notes         || "",
      createdBy:     createdBy     || "Admin",
      dueDate:       resolvedDueDate,
    });

    if (reportId) {
      await Report.updateOne(
        { reportId },
        { $set: { status: "In Progress" } }
      ).catch(console.error);
    }

    return res.status(201).json({ success: true, task: newTask });
  } catch (err) {
    console.error("POST /tasks:", err);
    return res.status(500).json({ success: false, message: "Failed to create task." });
  }
});

/* ─────────────────────────────────────────────────────────────
   PUT /api/tasks/:id
   Partial update — only fields present in the body are changed.
───────────────────────────────────────────────────────────── */
router.put("/:id", async (req, res) => {
  try {
    const {
      name, concernType, status, checklist,
      assignedStaff, priority, notes,
      comments, updatedBy, dueDate,
    } = req.body;

    const task = await ListsTask.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: "Task not found." });

    if (name          !== undefined) task.name          = String(name).trim();
    if (concernType   !== undefined) task.concernType   = concernType;
    if (checklist     !== undefined) task.checklist     = checklist;
    if (assignedStaff !== undefined) task.assignedStaff = assignedStaff;
    if (notes         !== undefined) task.notes         = notes;
    if (comments      !== undefined) task.comments      = comments;

    // ── Due date: explicit value wins; if priority changes and no
    //    dueDate was sent, only recalculate when the task has none yet.
    if (dueDate !== undefined) {
      task.dueDate = dueDate ? new Date(dueDate) : null;
    }

    if (priority !== undefined && priority !== task.priority) {
      task.priority = priority;
      // Recalculate dueDate only when the caller didn't supply one AND
      // the task doesn't already have a custom due date.
      if (dueDate === undefined && !task.dueDate) {
        task.dueDate = calcDueDate(priority);
      }
    }

    if (status !== undefined) {
      task.status = status;
      // Clear escalation flags when a task is closed.
      if (["Resolved", "Archived"].includes(status)) {
        task.isEscalated = false;
        task.escalatedAt = null;
      }
    }

    const updated = await task.save();

    // Mirror status back to the linked report if one exists.
    if (status !== undefined && task.reportId) {
      await Report.updateOne(
        { reportId: task.reportId },
        { $set: { status } }
      ).catch(console.error);
    }

    return res.json({ success: true, task: updated });
  } catch (err) {
    console.error("PUT /tasks/:id:", err);
    return res.status(500).json({ success: false, message: "Failed to update task." });
  }
});

/* ─────────────────────────────────────────────────────────────
   DELETE /api/tasks/:id
───────────────────────────────────────────────────────────── */
router.delete("/:id", async (req, res) => {
  try {
    const task = await ListsTask.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: "Task not found." });
    return res.json({ success: true, message: "Task deleted.", task });
  } catch (err) {
    console.error("DELETE /tasks/:id:", err);
    return res.status(500).json({ success: false, message: "Failed to delete task." });
  }
});

module.exports = router;