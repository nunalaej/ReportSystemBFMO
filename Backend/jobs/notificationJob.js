const { logNotification } = require("../utils/notificationlogger");

async function notify(task, emails, message) {
  if (emails.length === 0) {
    console.log(`[notificationJob] No active staff emails for "${task.name}" — skipping`);
    return;
  }

  await Promise.allSettled(
    emails.map(email =>
      sendTaskNotificationEmail({
        to: email, taskName: task.name,
        status: task.status, priority: task.priority,
        dueDate: task.dueDate, message,
      })
    )
  );

  await ListsTask.findByIdAndUpdate(task._id, {
    $set: { lastNotifiedAt: new Date() },
    $inc: { notificationsSent: 1 },
  }).catch(console.error);

  // ✅ Log to DB
  await logNotification({
    type:          task.isEscalated ? "task_escalated" : "task_updated",
    title:         task.isEscalated
                     ? `⚠️ Task escalated: "${task.name}"`
                     : `⏰ Reminder sent: "${task.name}"`,
    message:       `${message} Email sent to: ${emails.join(", ")}.`,
    taskId:        String(task._id),
    taskName:      task.name,
    changedBy:     "System",
    changedByRole: "system",
    affectedStaff: task.assignedStaff || [],
    emailSent:     true,
    emailCount:    emails.length,
    meta: {
      priority: task.priority,
      status:   task.status,
      dueDate:  task.dueDate,
    },
  }).catch(console.error);

  console.log(`[notificationJob] Notified ${emails.length} staff for "${task.name}"`);
}