// api/liststask.js
const express = require("express");
const router = express.Router();
const ListsTask = require("../models/Liststask");
const Report = require("../models/Report");

/* ============================================================
   GET ALL TASKS FOR USER
   GET /api/liststask?userId={userId}
============================================================ */
router.get("/", async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }

    const tasks = await ListsTask.find({ userId }).sort({ createdAt: -1 });
    res.json({ success: true, tasks });
  } catch (err) {
    console.error("GET /liststask error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to load tasks",
    });
  }
});

/* ============================================================
   GET SINGLE TASK
   GET /api/liststask/:id
============================================================ */
router.get("/:id", async (req, res) => {
  try {
    const task = await ListsTask.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    res.json({ success: true, task });
  } catch (err) {
    console.error("GET /liststask/:id error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to load task",
    });
  }
});

/* ============================================================
   CREATE TASK
   POST /api/liststask
============================================================ */
router.post("/", async (req, res) => {
  try {
    const {
      userId,
      name,
      concernType,
      reportId,
      assignedStaff,
      status,
      checklist,
    } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Task name is required",
      });
    }

    const newTask = await ListsTask.create({
      userId,
      name: name.trim(),
      concernType: concernType || "Mechanical",
      reportId: reportId || null,
      assignedStaff: assignedStaff || [],
      status: status || "Pending",
      checklist: checklist || [],
    });

    // If linked to a report, update report status to "In Progress"
    if (reportId) {
      await Report.updateOne(
        { reportId },
        { status: "In Progress" }
      ).catch((err) => {
        console.error("Failed to sync report status:", err);
      });
    }

    res.status(201).json({ success: true, task: newTask });
  } catch (err) {
    console.error("POST /liststask error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to create task",
    });
  }
});

/* ============================================================
   UPDATE TASK
   PUT /api/liststask/:id
============================================================ */
router.put("/:id", async (req, res) => {
  try {
    const { name, concernType, status, checklist, assignedStaff, reportId } =
      req.body;

    const task = await ListsTask.findById(req.params.id);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Update fields
    if (name !== undefined) task.name = name.trim();
    if (concernType !== undefined) task.concernType = concernType;
    if (status !== undefined) task.status = status;
    if (checklist !== undefined) task.checklist = checklist;
    if (assignedStaff !== undefined) task.assignedStaff = assignedStaff;

    const updated = await task.save();

    // ✅ SYNC: If task status changed to "Resolved", update linked report
    if (status && task.reportId) {
      let reportStatus = status;

      // Map task status to report status
      if (status === "Resolved") {
        reportStatus = "Resolved";
      } else if (status === "In Progress") {
        reportStatus = "In Progress";
      } else if (status === "Waiting for Materials") {
        reportStatus = "Waiting for Materials";
      } else if (status === "Pending") {
        reportStatus = "Pending";
      }

      await Report.updateOne(
        { reportId: task.reportId },
        { status: reportStatus }
      ).catch((err) => {
        console.error("Failed to sync report status:", err);
      });
    }

    res.json({ success: true, task: updated });
  } catch (err) {
    console.error("PUT /liststask/:id error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update task",
    });
  }
});

/* ============================================================
   UPDATE TASK CHECKLIST ITEM
   PUT /api/liststask/:id/checklist/:itemId
============================================================ */
router.put("/:id/checklist/:itemId", async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const { done, text } = req.body;

    const task = await ListsTask.findById(id);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    const item = task.checklist.id(itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Checklist item not found",
      });
    }

    if (done !== undefined) item.done = done;
    if (text !== undefined) item.text = text;

    const updated = await task.save();
    res.json({ success: true, task: updated });
  } catch (err) {
    console.error("PUT checklist item error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update checklist item",
    });
  }
});

/* ============================================================
   DELETE TASK
   DELETE /api/liststask/:id
============================================================ */
router.delete("/:id", async (req, res) => {
  try {
    const task = await ListsTask.findByIdAndDelete(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    res.json({
      success: true,
      message: "Task deleted",
      task,
    });
  } catch (err) {
    console.error("DELETE /liststask/:id error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to delete task",
    });
  }
});

/* ============================================================
   DELETE CHECKLIST ITEM
   DELETE /api/liststask/:id/checklist/:itemId
============================================================ */
router.delete("/:id/checklist/:itemId", async (req, res) => {
  try {
    const { id, itemId } = req.params;

    const task = await ListsTask.findById(id);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Remove checklist item by ID
    task.checklist.id(itemId).deleteOne();
    const updated = await task.save();

    res.json({ success: true, task: updated });
  } catch (err) {
    console.error("DELETE checklist item error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to delete checklist item",
    });
  }
});

/* ============================================================
   BULK UPDATE STATUS (for multiple tasks)
   PUT /api/liststask/bulk/status
============================================================ */
router.put("/bulk/status", async (req, res) => {
  try {
    const { taskIds, status } = req.body;

    if (!Array.isArray(taskIds) || !status) {
      return res.status(400).json({
        success: false,
        message: "taskIds array and status are required",
      });
    }

    const result = await ListsTask.updateMany(
      { _id: { $in: taskIds } },
      { status }
    );

    res.json({
      success: true,
      modifiedCount: result.modifiedCount,
      message: `Updated ${result.modifiedCount} task(s)`,
    });
  } catch (err) {
    console.error("PUT bulk status error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update tasks",
    });
  }
});

module.exports = router;