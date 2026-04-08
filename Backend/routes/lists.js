const express = require("express");
const router = express.Router();
const Liststask = require("../models/Liststask");

// GET /api/liststask?userId=...
router.get("/", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ success: false, message: "Missing userId" });
    const items = await Liststask.find({ userId }).sort({ createdAt: -1 }).lean();
    return res.json(items);
  } catch (err) {
    console.error("GET /liststask error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/liststask — create a new task
router.post("/", async (req, res) => {
  try {
    const { userId, name, concernType, reportId, assignedStaff, status, checklist } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: "Missing userId" });
    if (!name) return res.status(400).json({ success: false, message: "Missing name" });

    const doc = new Liststask({
      userId, name, concernType, reportId: reportId || null,
      assignedStaff: assignedStaff || [],
      status: status || "Pending",
      checklist: (checklist || []).map((item) => ({
        id: item.id || String(Date.now() + Math.random()),
        text: item.text,
        done: item.done || false,
      })),
    });
    await doc.save();
    return res.json({ success: true, item: doc });
  } catch (err) {
    console.error("POST /liststask error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/liststask/:id — update task fields (name, status, assignedStaff, etc.)
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Don't allow overwriting userId or _id
    delete updates.userId;
    delete updates._id;

    const doc = await Liststask.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: "Task not found" });
    return res.json({ success: true, item: doc });
  } catch (err) {
    console.error("PUT /liststask/:id error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/liststask/:id/checklist/:itemId — toggle a single checklist item
router.put("/:id/checklist/:itemId", async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const { done } = req.body;

    if (typeof done !== "boolean") {
      return res.status(400).json({ success: false, message: "done must be a boolean" });
    }

    const doc = await Liststask.findById(id);
    if (!doc) return res.status(404).json({ success: false, message: "Task not found" });

    const item = doc.checklist.find((c) => c.id === itemId);
    if (!item) return res.status(404).json({ success: false, message: "Checklist item not found" });

    item.done = done;
    await doc.save();

    return res.json({ success: true, item: doc });
  } catch (err) {
    console.error("PUT /liststask/:id/checklist/:itemId error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/liststask/:id
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await Liststask.findByIdAndDelete(id);
    if (!doc) return res.status(404).json({ success: false, message: "Task not found" });
    return res.json({ success: true });
  } catch (err) {
    console.error("DELETE /liststask/:id error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;