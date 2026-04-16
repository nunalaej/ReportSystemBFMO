const express   = require("express");
const router    = express.Router();
const ListsTask = require("../models/Liststask");
const Report    = require("../models/Report");

/* GET /api/tasks */
router.get("/", async (req, res) => {
  try {
    const tasks = await ListsTask.find({}).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, tasks });
  } catch (err) {
    console.error("GET /tasks:", err);
    return res.status(500).json({ success: false, message: "Failed to load tasks." });
  }
});

/* GET /api/tasks/:id */
router.get("/:id", async (req, res) => {
  try {
    const task = await ListsTask.findById(req.params.id).lean();
    if (!task) return res.status(404).json({ success: false, message: "Task not found." });
    return res.json({ success: true, task });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed." });
  }
});

/* POST /api/tasks */
router.post("/", async (req, res) => {
  try {
    const { userId, name, concernType, reportId, assignedStaff, status, checklist, priority, notes, createdBy } = req.body;

    if (!name?.trim()) return res.status(400).json({ success: false, message: "Task name is required." });

    if (reportId) {
      const existing = await ListsTask.findOne({ reportId });
      if (existing) return res.status(400).json({ success: false, message: "A task with this Report ID already exists." });
    }

    const newTask = await ListsTask.create({
      userId:        userId        || "admin",
      name:          name.trim(),
      concernType:   concernType   || "Other",
      reportId:      reportId      || null,
      assignedStaff: assignedStaff || [],
      status:        status        || "Pending",
      checklist:     checklist     || [],
      priority:      priority      || "",
      notes:         notes         || "",
      createdBy:     createdBy     || "Admin",
    });

    if (reportId) {
      await Report.updateOne({ reportId }, { status: "In Progress" }).catch(console.error);
    }

    return res.status(201).json({ success: true, task: newTask });
  } catch (err) {
    console.error("POST /tasks:", err);
    return res.status(500).json({ success: false, message: "Failed to create task." });
  }
});

/* PUT /api/tasks/:id */
router.put("/:id", async (req, res) => {
  try {
    const { name, concernType, status, checklist, assignedStaff, priority, notes } = req.body;

    const task = await ListsTask.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: "Task not found." });

    if (name          !== undefined) task.name          = String(name).trim();
    if (concernType   !== undefined) task.concernType   = concernType;
    if (status        !== undefined) task.status        = status;
    if (checklist     !== undefined) task.checklist     = checklist;
    if (assignedStaff !== undefined) task.assignedStaff = assignedStaff;
    if (priority      !== undefined) task.priority      = priority;
    if (notes         !== undefined) task.notes         = notes;

    const updated = await task.save();

    if (status && task.reportId) {
      await Report.updateOne({ reportId: task.reportId }, { status }).catch(console.error);
    }

    return res.json({ success: true, task: updated });
  } catch (err) {
    console.error("PUT /tasks/:id:", err);
    return res.status(500).json({ success: false, message: "Failed to update task." });
  }
});

/* DELETE /api/tasks/:id */
router.delete("/:id", async (req, res) => {
  try {
    const task = await ListsTask.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: "Task not found." });
    return res.json({ success: true, message: "Task deleted.", task });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to delete." });
  }
});

module.exports = router;