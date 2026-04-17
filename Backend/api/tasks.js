const express   = require("express");
const router    = express.Router();
const ListsTask = require("../models/Liststask");
const Report    = require("../models/Report");
const { logNotification } = require("../utils/notificationlogger");

const PRIORITY_MAX_DAYS = { Urgent: 1, High: 7, Medium: 30, Low: 90 };

function calcDueDate(priority) {
  const days = PRIORITY_MAX_DAYS[priority];
  if (!days) return null;
  const due = new Date();
  due.setDate(due.getDate() + days);
  return due;
}

/* ── GET all ── */
router.get("/", async (req, res) => {
  try {
    const tasks = await ListsTask.find({}).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, tasks });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to load tasks." });
  }
});

/* ── GET one ── */
router.get("/:id", async (req, res) => {
  try {
    const task = await ListsTask.findById(req.params.id).lean();
    if (!task) return res.status(404).json({ success: false, message: "Task not found." });
    return res.json({ success: true, task });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to load task." });
  }
});

/* ── POST create ── */
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

    const resolvedDueDate = dueDate ? new Date(dueDate) : calcDueDate(priority || "");

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

    // ✅ Log creation
    await logNotification({
      type:          "task_created",
      title:         `New task created: "${name}"`,
      message:       `Task "${name}" was created by ${createdBy || "Admin"}.` +
                     (priority           ? ` Priority: ${priority}.`              : "") +
                     (reportId           ? ` Linked to report #${reportId}.`      : "") +
                     (assignedStaff?.length ? ` Assigned to: ${assignedStaff.join(", ")}.` : ""),
      taskId:        String(newTask._id),
      taskName:      name,
      reportId,
      changedBy:     createdBy     || "Admin",
      changedByRole: "admin",
      toValue:       status        || "Pending",
      affectedStaff: Array.isArray(assignedStaff) ? assignedStaff : [],
      meta: { priority, concernType },
    });

    return res.status(201).json({ success: true, task: newTask });
  } catch (err) {
    console.error("POST /tasks:", err);
    return res.status(500).json({ success: false, message: "Failed to create task." });
  }
});

/* ── PUT update ── */
router.put("/:id", async (req, res) => {
  try {
    const task = await ListsTask.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: "Task not found." });

    const {
      name, concernType, status, checklist,
      assignedStaff, priority, notes,
      comments, updatedBy, dueDate,
    } = req.body;

    // Capture old values BEFORE mutating
    const oldStatus   = task.status;
    const oldPriority = task.priority;
    const oldStaff    = [...(task.assignedStaff || [])];

    // Apply updates
    if (name          !== undefined) task.name          = String(name).trim();
    if (concernType   !== undefined) task.concernType   = concernType;
    if (checklist     !== undefined) task.checklist     = checklist;
    if (assignedStaff !== undefined) task.assignedStaff = assignedStaff;
    if (notes         !== undefined) task.notes         = notes;
    if (comments      !== undefined) task.comments      = comments;

    if (dueDate !== undefined) {
      task.dueDate = dueDate ? new Date(dueDate) : null;
    }

    if (priority !== undefined && priority !== task.priority) {
      task.priority = priority;
      if (dueDate === undefined && !task.dueDate) {
        task.dueDate = calcDueDate(priority);
      }
    }

    if (status !== undefined) {
      task.status = status;
      if (["Resolved", "Archived"].includes(status)) {
        task.isEscalated = false;
        task.escalatedAt = null;
      }
    }

    const updated = await task.save();

    // Mirror to report
    if (status !== undefined && task.reportId) {
      await Report.updateOne(
        { reportId: task.reportId },
        { $set: { status } }
      ).catch(console.error);
    }

    // ✅ Log status change
    if (status !== undefined && status !== oldStatus) {
      await logNotification({
        type:          "task_status_changed",
        title:         `Status changed: "${updated.name}"`,
        message:       `Status changed from "${oldStatus}" to "${status}" by ${updatedBy || "Admin"}.`,
        taskId:        String(updated._id),
        taskName:      updated.name,
        reportId:      updated.reportId,
        changedBy:     updatedBy     || "Admin",
        changedByRole: "admin",
        fromValue:     oldStatus,
        toValue:       status,
        affectedStaff: updated.assignedStaff || [],
        meta: { priority: updated.priority },
      });
    }

    // ✅ Log priority change
    if (priority !== undefined && priority !== oldPriority) {
      await logNotification({
        type:          "task_updated",
        title:         `Priority changed: "${updated.name}"`,
        message:       `Priority changed from "${oldPriority || "none"}" to "${priority}" by ${updatedBy || "Admin"}.`,
        taskId:        String(updated._id),
        taskName:      updated.name,
        changedBy:     updatedBy     || "Admin",
        changedByRole: "admin",
        fromValue:     oldPriority   || "none",
        toValue:       priority,
        affectedStaff: updated.assignedStaff || [],
      });
    }

    // ✅ Log staff assignment change
    if (assignedStaff !== undefined) {
      const newStaff = assignedStaff;
      const added    = newStaff.filter(s => !oldStaff.includes(s));
      const removed  = oldStaff.filter(s => !newStaff.includes(s));
      if (added.length || removed.length) {
        await logNotification({
          type:          "task_assigned",
          title:         `Staff assignment changed: "${updated.name}"`,
          message:       [
            added.length   ? `Added: ${added.join(", ")}.`     : "",
            removed.length ? `Removed: ${removed.join(", ")}.` : "",
            `Changed by ${updatedBy || "Admin"}.`,
          ].filter(Boolean).join(" "),
          taskId:        String(updated._id),
          taskName:      updated.name,
          changedBy:     updatedBy     || "Admin",
          changedByRole: "admin",
          affectedStaff: newStaff,
          meta: { added, removed },
        });
      }
    }

    // ✅ Log general update (checklist, notes) only if nothing else was logged
    const noSpecificLog = status === undefined && priority === undefined &&
                          (assignedStaff === undefined ||
                           assignedStaff.join() === oldStaff.join());
    if (noSpecificLog && (checklist !== undefined || notes !== undefined || name !== undefined)) {
      await logNotification({
        type:          "task_updated",
        title:         `Task updated: "${updated.name}"`,
        message:       `Task details were updated by ${updatedBy || "Admin"}.`,
        taskId:        String(updated._id),
        taskName:      updated.name,
        changedBy:     updatedBy     || "Admin",
        changedByRole: "admin",
        affectedStaff: updated.assignedStaff || [],
      });
    }

    return res.json({ success: true, task: updated });
  } catch (err) {
    console.error("PUT /tasks/:id:", err);
    return res.status(500).json({ success: false, message: "Failed to update task." });
  }
});

/* ── DELETE ── */
router.delete("/:id", async (req, res) => {
  try {
    const task = await ListsTask.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: "Task not found." });

    // ✅ Log deletion
    await logNotification({
      type:          "task_deleted",
      title:         `Task deleted: "${task.name}"`,
      message:       `Task "${task.name}" was permanently deleted by ${req.body?.deletedBy || "Admin"}.`,
      taskId:        String(task._id),
      taskName:      task.name,
      reportId:      task.reportId,
      changedBy:     req.body?.deletedBy || "Admin",
      changedByRole: "admin",
      affectedStaff: task.assignedStaff || [],
      meta: { priority: task.priority, status: task.status },
    });

    return res.json({ success: true, message: "Task deleted.", task });
  } catch (err) {
    console.error("DELETE /tasks/:id:", err);
    return res.status(500).json({ success: false, message: "Failed to delete task." });
  }
});

module.exports = router;