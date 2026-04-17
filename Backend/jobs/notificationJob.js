/**
 * Backend/jobs/notificationJob.js
 * ─────────────────────────────────────────────────────────────
 * Runs every hour via node-cron.
 *
 * NOTIFICATION SCHEDULE PER PRIORITY
 * ─────────────────────────────────────────────────────────────
 * All priorities: first notification at 9 AM on the due date,
 * then with increasing frequency as time passes.
 *
 * Low    (max 90 days):  notify every 7 days → daily in last 3 days
 *                        → escalate to Unfinished after 90 days
 * Medium (max 30 days):  notify every 3 days → every 8 h in last 24 h
 *                        → escalate to Unfinished after 30 days
 * High   (max 7 days):   notify every 1 day → every 4 h in last 12 h
 *                        → escalate to Unfinished after 7 days
 * Urgent (max 1 day):    notify every 1 hour throughout
 *                        → escalate to Unfinished after 1 day
 *
 * Unfinished tasks: notify every 3 days until resolved/archived.
 *
 * HOW TO START:
 *   Add to Backend/server.js (or app.js):
 *     require("./jobs/notificationJob");
 */

const cron      = require("node-cron");
const ListsTask = require("../models/Liststask");
const Staff     = require("../models/Staff");
const { sendTaskNotificationEmail } = require("../utils/mailer");

/* ── Priority rules ──────────────────────────────────────── */
/**
 * notifyEveryHours  — default interval between notifications
 * maxDays           — days until task is escalated to Unfinished
 * escalateLabel     — status string used when escalating
 */
const PRIORITY_RULES = {
  Urgent: { maxDays: 1,  notifyEveryHours: 1,   escalateLabel: "Unfinished" },
  High:   { maxDays: 7,  notifyEveryHours: 24,  escalateLabel: "Unfinished" },
  Medium: { maxDays: 30, notifyEveryHours: 72,  escalateLabel: "Unfinished" },
  Low:    { maxDays: 90, notifyEveryHours: 168, escalateLabel: "Unfinished" },
};

/** Notification interval for already-escalated (Unfinished) tasks: 3 days */
const UNFINISHED_NOTIFY_HOURS = 72;

/* ── Helpers ─────────────────────────────────────────────── */
function hoursSince(date) {
  if (!date) return Infinity;
  return (Date.now() - new Date(date).getTime()) / 3_600_000;
}

function hoursUntil(date) {
  if (!date) return Infinity;
  return (new Date(date).getTime() - Date.now()) / 3_600_000;
}

/**
 * Resolve the effective notification interval in hours,
 * dynamically tightening it as the due date approaches.
 */
function effectiveInterval(priority, hoursLeft) {
  const rule = PRIORITY_RULES[priority];
  if (!rule) return Infinity;

  let interval = rule.notifyEveryHours;

  switch (priority) {
    case "Low":
      if (hoursLeft <= 72)  interval = 24; // last 3 days → daily
      break;
    case "Medium":
      if (hoursLeft <= 24)  interval = 8;  // last 24 h → every 8 h
      break;
    case "High":
      if (hoursLeft <= 12)  interval = 4;  // last 12 h → every 4 h
      break;
    case "Urgent":
      interval = 1;                         // always hourly
      break;
  }

  return interval;
}

/** Resolve email addresses for the list of assigned staff names. */
async function getStaffEmails(assignedStaff) {
  if (!Array.isArray(assignedStaff) || assignedStaff.length === 0) return [];
  try {
    const members = await Staff.find(
      { name: { $in: assignedStaff }, active: true },
      { email: 1 }
    ).lean();
    return members.map(m => m.email).filter(Boolean);
  } catch (err) {
    console.error("[notificationJob] getStaffEmails error:", err.message);
    return [];
  }
}

/* ── Per-task logic ──────────────────────────────────────── */
async function processTask(task, now) {
  // Skip tasks that are already closed.
  if (["Resolved", "Archived"].includes(task.status || "")) return;

  const emails = await getStaffEmails(task.assignedStaff || []);

  /* ── 1. Escalated / Unfinished tasks ── */
  if (task.isEscalated || task.status === "Unfinished") {
    const hoursSinceNotify = hoursSince(task.lastNotifiedAt);
    if (hoursSinceNotify >= UNFINISHED_NOTIFY_HOURS) {
      await notify(
        task, emails,
        "⚠️ This task is OVERDUE and remains unresolved. Please close it as soon as possible."
      );
    }
    return;
  }

  const rule     = PRIORITY_RULES[task.priority];
  const dueDate  = task.dueDate ? new Date(task.dueDate) : null;

  // No rule means no priority set — skip.
  if (!rule || !dueDate) return;

  const hoursLeft = hoursUntil(dueDate);

  /* ── 2. Past due → escalate ── */
  if (hoursLeft <= 0 && ["Pending", "Pending Inspect"].includes(task.status || "")) {
    console.log(
      `[notificationJob] Escalating "${task.name}" (${task._id}) → Unfinished`
    );
    await ListsTask.findByIdAndUpdate(task._id, {
      $set: {
        status:         "Unfinished",
        isEscalated:    true,
        escalatedAt:    now,
        lastNotifiedAt: now,
      },
      $inc: { notificationsSent: 1 },
    });
    await notify(
      task, emails,
      `🚨 This "${task.priority}" priority task has exceeded its ${rule.maxDays}-day ` +
      `deadline and has been escalated to UNFINISHED status.`
    );
    return;
  }

  /* ── 3. Regular timed notification ── */
  const interval         = effectiveInterval(task.priority, hoursLeft);
  const hoursSinceNotify = hoursSince(task.lastNotifiedAt);

  if (hoursSinceNotify < interval) return; // Too soon — skip.

  const daysLeft  = Math.ceil(hoursLeft / 24);
  const timeLabel =
    hoursLeft < 1  ? "less than 1 hour" :
    hoursLeft < 24 ? `${Math.round(hoursLeft)} hours` :
                     `${daysLeft} day${daysLeft !== 1 ? "s" : ""}`;

  await notify(
    task, emails,
    hoursLeft <= 0
      ? "⏰ This task is now OVERDUE."
      : `⏰ This task is due in ${timeLabel}.`
  );
}

/* ── Send + record ───────────────────────────────────────── */
async function notify(task, emails, message) {
  if (emails.length === 0) {
    console.log(
      `[notificationJob] No active staff emails for "${task.name}" — skipping`
    );
    return;
  }

  await Promise.allSettled(
    emails.map(email =>
      sendTaskNotificationEmail({
        to:       email,
        taskName: task.name,
        status:   task.status,
        priority: task.priority,
        dueDate:  task.dueDate,
        message,
      })
    )
  );

  await ListsTask.findByIdAndUpdate(task._id, {
    $set: { lastNotifiedAt: new Date() },
    $inc: { notificationsSent: 1 },
  }).catch(console.error);

  console.log(
    `[notificationJob] Notified ${emails.length} staff for "${task.name}" — ${message}`
  );
}

/* ── Main loop ───────────────────────────────────────────── */
async function runNotificationJob() {
  const now = new Date();
  console.log(`[notificationJob] Running at ${now.toISOString()}`);

  try {
    const tasks = await ListsTask.find({
      status: { $nin: ["Resolved", "Archived"] },
    }).lean();

    console.log(`[notificationJob] Processing ${tasks.length} open task(s)`);

    // Process sequentially to avoid hammering the mailer.
    for (const task of tasks) {
      await processTask(task, now).catch(err =>
        console.error(
          `[notificationJob] Error processing task ${task._id}:`,
          err.message
        )
      );
    }
  } catch (err) {
    console.error("[notificationJob] Fatal error:", err.message);
  }
}

/* ── Schedule: top of every hour ────────────────────────────
   "0 * * * *"  →  at minute 0 of every hour, every day
────────────────────────────────────────────────────────────*/
cron.schedule("0 * * * *", async () => {
  await runNotificationJob();
});

console.log("[notificationJob] Scheduled — runs at the top of every hour");

// Run once 5 s after startup so the first check doesn't wait an hour.
setTimeout(() => {
  runNotificationJob().catch(console.error);
}, 5_000);

module.exports = { runNotificationJob };