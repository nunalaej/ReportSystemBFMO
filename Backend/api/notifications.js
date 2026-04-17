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
    if (type)   query.type = type;
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