// utils/notificationLogger.js
const Notification = require("../models/Notification");

async function logNotification({
  type = "system",
  title,
  message,
  taskId,
  taskName,
  reportId,
  changedBy = "System",
  changedByRole = "system",
  fromValue,
  toValue,
  affectedStaff = [],
  emailSent = false,
  emailCount = 0,
  meta = {},
}) {
  try {
    const notif = await Notification.create({
      type, title, message, taskId, taskName,
      reportId, changedBy, changedByRole,
      fromValue, toValue, affectedStaff,
      emailSent, emailCount, meta,
    });
    return notif;
  } catch (err) {
    console.error("[notificationLogger] Failed to log:", err.message);
    return null;
  }
}

module.exports = { logNotification };