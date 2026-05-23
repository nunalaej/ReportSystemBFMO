// api/notifications.js
const express      = require("express");
const router       = express.Router();
const Notification = require("../models/Notification");

// GET all notifications (paginated, newest first)
router.get("/", async (req, res) => {
  try {
    const limit  = parseInt(req.query.limit  || "50");
    const skip   = parseInt(req.query.skip   || "0");
    const type   = req.query.type;
    const unread = req.query.unread;

    const query = {};
    if (type)              query.type = type;
    if (unread === "true") query.read = false;

    const [notifications, total] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(query),
    ]);

    const unreadCount = await Notification.countDocuments({ read: false });

    return res.json({ success: true, notifications, total, unreadCount });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── NEW: POST create a notification (used by student follow-up, etc.) ──
router.post("/", async (req, res) => {
  try {
    const {
      type, title, message,
      taskId, taskName, reportId,
      changedBy, changedByRole,
      fromValue, toValue,
      affectedStaff, meta,
    } = req.body;

    if (!title || !message) {
      return res.status(400).json({ success: false, message: "title and message are required." });
    }

    const notif = await Notification.create({
      type:         type         || "system",
      title:        title,
      message:      message,
      taskId:       taskId       || undefined,
      taskName:     taskName     || undefined,
      reportId:     reportId     || undefined,
      changedBy:    changedBy    || undefined,
      changedByRole:changedByRole|| undefined,
      fromValue:    fromValue    || undefined,
      toValue:      toValue      || undefined,
      affectedStaff: Array.isArray(affectedStaff) ? affectedStaff : [],
      meta:         meta         || undefined,
      read:         false,
    });

    return res.status(201).json({ success: true, notification: notif });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH mark one as read
router.patch("/:id/read", async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { read: true });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH mark all as read
router.patch("/mark-all-read", async (req, res) => {
  try {
    await Notification.updateMany({ read: false }, { read: true });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE clear all
router.delete("/clear-all", async (req, res) => {
  try {
    await Notification.deleteMany({});
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;