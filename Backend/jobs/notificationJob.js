// jobs/notificationJob.js
//
// Runs on a schedule and sends email + DB notifications to staff
// whose tasks are approaching or past their deadline.
//
// Priority intervals (defaults, configurable via Admin Edit → Priority Levels):
//   Urgent  → every 1 hour
//   High    → every 1 day
//   Medium  → every 3 days
//   Low     → every 5 days
//
// After deadline → task escalates to "Unfinished", notify every 3 days

const cron                  = require("node-cron");
const ListsTask             = require("../models/Liststask");
const Staff                 = require("../models/Staff");
const Meta                  = require("../models/Meta");
const { logNotification }   = require("../utils/notificationlogger");
const { sendTaskNotificationEmail } = require("../utils/mailer");

/* ── Default intervals in HOURS per priority name ─────────── */
const DEFAULT_INTERVALS_HOURS = {
  Urgent: 1,
  High:   24,
  Medium: 72,   // 3 days
  Low:    120,  // 5 days
};

/* ── After-deadline escalation interval (hours) ──────────── */
const ESCALATION_NOTIFY_HOURS = 72; // 3 days

/* ── Max duration per priority in days (for due date calc) ── */
const PRIORITY_MAX_DAYS = {
  Urgent: 1,
  High:   7,
  Medium: 30,
  Low:    90,
};

/* ── Convert notifyInterval string → hours ─────────────────── */
function intervalToHours(notifyInterval) {
  switch (notifyInterval) {
    case "hourly":  return 1;
    case "daily":   return 24;
    case "1week":   return 168;
    case "1month":  return 720;
    case "3months": return 2160;
    // custom values like "3days", "5days" etc
    default: {
      const m = String(notifyInterval || "").match(/^(\d+)(h|d|w)?$/i);
      if (m) {
        const n = parseInt(m[1], 10);
        const unit = (m[2] || "h").toLowerCase();
        if (unit === "h") return n;
        if (unit === "d") return n * 24;
        if (unit === "w") return n * 168;
      }
      return null; // fall through to default
    }
  }
}

/* ── Load priority intervals from DB (with fallback) ─────── */
async function loadPriorityIntervals() {
  try {
    const meta = await Meta.findOne({ key: "main" }).lean();
    if (!meta?.priorities?.length) return { ...DEFAULT_INTERVALS_HOURS };
    const map = {};
    for (const p of meta.priorities) {
      const hours = intervalToHours(p.notifyInterval);
      map[p.name] = hours != null ? hours : (DEFAULT_INTERVALS_HOURS[p.name] ?? 24);
    }
    return map;
  } catch {
    return { ...DEFAULT_INTERVALS_HOURS };
  }
}

/* ── Main notification runner ──────────────────────────────── */
async function runNotificationJob() {
  console.log("[NotificationJob] Running at", new Date().toISOString());

  const priorityIntervals = await loadPriorityIntervals();
  const now = new Date();

  try {
    // Fetch all active (non-resolved, non-archived) tasks that have a priority
    const tasks = await ListsTask.find({
      status:   { $nin: ["Resolved", "Archived"] },
      priority: { $exists: true, $ne: "" },
    }).lean();

    console.log(`[NotificationJob] Checking ${tasks.length} active tasks`);

    for (const task of tasks) {
      try {
        await processTask(task, now, priorityIntervals);
      } catch (err) {
        console.error(`[NotificationJob] Error processing task ${task._id}:`, err.message);
      }
    }
  } catch (err) {
    console.error("[NotificationJob] Fatal error:", err.message);
  }
}

async function processTask(task, now, priorityIntervals) {
  const priority      = task.priority || "";
  const intervalHours = priorityIntervals[priority];
  if (!intervalHours) return; // unknown priority — skip

  const intervalMs  = intervalHours * 60 * 60 * 1000;
  const lastNotified = task.lastNotifiedAt ? new Date(task.lastNotifiedAt) : null;
  const dueDate      = task.dueDate ? new Date(task.dueDate) : null;
  const isPastDue    = dueDate && now > dueDate;

  // ── Check if it's time to notify ─────────────────────────
  if (lastNotified) {
    const msSinceLast = now - lastNotified;
    const requiredMs  = isPastDue
      ? ESCALATION_NOTIFY_HOURS * 60 * 60 * 1000
      : intervalMs;
    if (msSinceLast < requiredMs) return; // not yet time
  }

  // ── Build notification message ────────────────────────────
  let message, notifType, title;

  if (isPastDue && !task.isEscalated) {
    // First time past deadline → escalate
    message   = `Task "${task.name}" (${priority}) is OVERDUE. Due: ${dueDate.toLocaleDateString("en-PH")}. Escalating to Unfinished.`;
    title     = `Task overdue & escalated: "${task.name}"`;
    notifType = "task_escalated";

    // Mark task as Unfinished + escalated
    await ListsTask.findByIdAndUpdate(task._id, {
      status:      "Unfinished",
      isEscalated: true,
      escalatedAt: now,
    });

  } else if (isPastDue && task.isEscalated) {
    // Already escalated — periodic reminder
    message   = `Task "${task.name}" (${priority}) remains unfinished. Please resolve or update.`;
    title     = `Unfinished task reminder: "${task.name}"`;
    notifType = "task_escalated";

  } else if (dueDate) {
    // Still active — check urgency
    const hoursLeft = (dueDate - now) / (60 * 60 * 1000);
    const daysLeft  = Math.ceil(hoursLeft / 24);

    if (hoursLeft <= 0) return; // handled above

    const urgencyTag = hoursLeft <= 24
      ? `⚠️ Due in ${Math.ceil(hoursLeft)}h`
      : `Due in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`;

    message   = `Task "${task.name}" (${priority}): ${urgencyTag} — ${dueDate.toLocaleDateString("en-PH")}.`;
    title     = `Task reminder (${priority}): "${task.name}"`;
    notifType = "task_escalated";

  } else {
    // No due date — just a periodic nudge
    message   = `Reminder: Task "${task.name}" (${priority}) is still open.`;
    title     = `Open task reminder: "${task.name}"`;
    notifType = "task_updated";
  }

  // ── Log to DB ─────────────────────────────────────────────
  await logNotification({
    type:          notifType,
    title,
    message,
    taskId:        String(task._id),
    taskName:      task.name,
    reportId:      task.reportId || null,
    changedBy:     "System",
    changedByRole: "system",
    affectedStaff: task.assignedStaff || [],
    meta: { priority, dueDate: dueDate?.toISOString() },
  });

  // ── Send emails to assigned staff ─────────────────────────
  if (task.assignedStaff?.length) {
    for (const staffName of task.assignedStaff) {
      try {
        const staffRecord = await Staff.findOne({
          name: { $regex: new RegExp(`^${staffName.trim()}$`, "i") },
        }).lean();

        if (staffRecord?.email) {
          await sendTaskNotificationEmail({
            to:       staffRecord.email,
            taskName: task.name,
            status:   task.status,
            priority,
            dueDate:  dueDate?.toISOString(),
            message,
          });
        }
      } catch (emailErr) {
        console.error(`[NotificationJob] Email failed for ${staffName}:`, emailErr.message);
      }
    }
  }

  // ── Update lastNotifiedAt ─────────────────────────────────
  await ListsTask.findByIdAndUpdate(task._id, {
    lastNotifiedAt:    now,
    $inc: { notificationsSent: 1 },
  });

  console.log(`[NotificationJob] Notified: "${task.name}" (${priority})`);
}

/* ── Schedule: run every hour ─────────────────────────────── */
// Runs at the top of every hour: "0 * * * *"
// For testing you can use "*/5 * * * *" (every 5 minutes)
cron.schedule("0 * * * *", () => {
  runNotificationJob().catch(err =>
    console.error("[NotificationJob] Unhandled error:", err)
  );
});

console.log("[NotificationJob] Scheduler initialized — runs hourly");

module.exports = { runNotificationJob };