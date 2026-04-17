// Backend/utils/mailer.js
//
// ─────────────────────────────────────────────────────────────────────────────
// TWO senders:
//   1. Resend API  — used for report status emails (your existing setup)
//   2. Nodemailer SMTP — used for task notifications (can reach ANY email)
//
// WHY TWO?
//   Resend free plan only sends to verified domains.
//   SMTP (Gmail App Password) can send to anyone for free.
//
// SETUP for SMTP — add these to Render environment variables:
//   SMTP_HOST = smtp.gmail.com
//   SMTP_PORT = 587
//   SMTP_USER = your.gmail@gmail.com
//   SMTP_PASS = xxxx xxxx xxxx xxxx   ← Gmail App Password (NOT your password)
//   SMTP_FROM = BFMO System <your.gmail@gmail.com>
//
// Gmail App Password setup (free, takes 2 min):
//   1. https://myaccount.google.com/security → enable 2-Step Verification
//   2. https://myaccount.google.com/apppasswords → create for "Mail"
//   3. Copy the 16-char code → paste as SMTP_PASS in Render
// ─────────────────────────────────────────────────────────────────────────────

const nodemailer = require("nodemailer");

const { RESEND_API_KEY, FROM_EMAIL, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

/* ══════════════════════════════════════════════════════════
   SMTP TRANSPORTER (for task notifications)
══════════════════════════════════════════════════════════ */
let _smtpTransporter = null;

function getSmtpTransporter() {
  if (_smtpTransporter) return _smtpTransporter;
  if (!SMTP_USER || !SMTP_PASS) {
    console.warn("[Mailer] SMTP_USER or SMTP_PASS not set — task emails will be skipped.");
    return null;
  }
  _smtpTransporter = nodemailer.createTransport({
    host:   SMTP_HOST || "smtp.gmail.com",
    port:   parseInt(SMTP_PORT || "587", 10),
    secure: parseInt(SMTP_PORT || "587", 10) === 465,
    auth:   { user: SMTP_USER, pass: SMTP_PASS },
    tls:    { rejectUnauthorized: false },
  });
  return _smtpTransporter;
}

async function sendViaSMTP({ to, subject, html, text }) {
  const transporter = getSmtpTransporter();
  if (!transporter) {
    console.log(`[Mailer/SMTP] Skipped (no SMTP config): "${subject}" → ${to}`);
    return;
  }
  if (!to) return;
  try {
    const from = SMTP_FROM || `BFMO System <${SMTP_USER}>`;
    const info = await transporter.sendMail({ from, to, subject, html, text });
    console.log(`[Mailer/SMTP] Sent "${subject}" → ${to} (${info.messageId})`);
  } catch (err) {
    console.error(`[Mailer/SMTP] Failed to send "${subject}" → ${to}:`, err.message);
  }
}

/* ══════════════════════════════════════════════════════════
   REPORT STATUS EMAIL  (uses Resend — your existing logic)
══════════════════════════════════════════════════════════ */
async function sendReportStatusEmail({ to, heading, status, reportId, comment }) {
  console.log("[Mailer] sendReportStatusEmail called with:", { to, heading, status, reportId });

  try {
    if (!to || !status) {
      console.warn("[Mailer] Missing 'to' or 'status', aborting email.");
      return;
    }

    const allowedStatuses = ["Waiting for Materials", "In Progress", "Resolved"];
    if (!allowedStatuses.includes(status)) {
      console.log(`[Mailer] Status '${status}' not in allowed list — skipping.`);
      return;
    }

    if (!RESEND_API_KEY) {
      console.warn("[Mailer] RESEND_API_KEY missing — falling back to SMTP.");
      // Fallback: send via SMTP if Resend not configured
      await sendViaSMTP({
        to,
        subject: `BFMO Report Update: ${status}`,
        html:    buildReportHtml({ heading, status, reportId, comment }),
        text:    buildReportText({ heading, status, reportId, comment }),
      });
      return;
    }

    const subject  = `BFMO Report Update: ${status}`;
    const title    = heading || "Facilities concern submitted to BFMO";
    const htmlBody = buildReportHtml({ heading: title, status, reportId, comment });
    const textBody = buildReportText({ heading: title, status, reportId, comment });

    console.log("[Mailer] Sending via Resend...");

    const res = await fetch("https://api.resend.com/emails", {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from:     FROM_EMAIL || "BFMO Reports <onboarding@resend.dev>",
        to:       [to],
        subject,
        text:     textBody,
        html:     htmlBody,
        reply_to: "bfmodlsud@gmail.com",
      }),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      console.error("[Mailer] Resend error:", res.status, errorText);
      return;
    }

    const data = await res.json().catch(() => null);
    console.log("[Mailer] Sent via Resend:", data);

  } catch (err) {
    console.error("[Mailer] Fatal error:", err);
  }
}

/* ══════════════════════════════════════════════════════════
   TASK NOTIFICATION EMAIL  (uses SMTP — reaches any email)
══════════════════════════════════════════════════════════ */
async function sendTaskNotificationEmail({ to, taskName, status, priority, dueDate, message }) {
  if (!to) return;

  const subject    = `[BFMO Task] ${message?.slice(0, 60) || `Task Update: ${taskName}`}`;
  const dueDateStr = dueDate
    ? new Date(dueDate).toLocaleDateString("en-PH", { dateStyle: "medium" })
    : "No due date set";

  const html = `
    <div style="font-family:system-ui,sans-serif;font-size:14px;color:#111827;background:#f3f4f6;padding:24px">
      <div style="max-width:580px;margin:0 auto;background:#fff;border-radius:8px;padding:24px;box-shadow:0 4px 16px rgba(0,0,0,0.08)">
        <h1 style="margin:0 0 4px;font-size:18px;font-weight:700;color:#029006">BFMO Task Notification</h1>
        <p style="margin:0 0 16px;font-size:13px;color:#6b7280">Automated task update</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin-bottom:16px"/>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px;margin-bottom:16px">
          <p style="margin:0 0 6px"><strong>Task:</strong> ${taskName}</p>
          <p style="margin:0 0 6px"><strong>Status:</strong> ${status || "Pending"}</p>
          <p style="margin:0 0 6px"><strong>Priority:</strong> ${priority || "—"}</p>
          <p style="margin:0"><strong>Due Date:</strong> ${dueDateStr}</p>
        </div>
        ${message ? `
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;margin-bottom:16px;color:#dc2626">
            <strong>⚠️ ${message}</strong>
          </div>
        ` : ""}
        <p style="margin:0 0 4px;font-size:13px;color:#6b7280">
          Please log in to the BFMO system to update this task.
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0 8px"/>
        <p style="margin:0;font-size:12px;color:#9ca3af">
          This is an automated notification from the BFMO Report System.
        </p>
      </div>
    </div>
  `;

  const text = [
    "BFMO Task Notification",
    "",
    `Task: ${taskName}`,
    `Status: ${status || "Pending"}`,
    `Priority: ${priority || "—"}`,
    `Due Date: ${dueDateStr}`,
    message ? `\n⚠️ ${message}` : "",
    "",
    "Please log in to the BFMO system to update this task.",
  ].filter(l => l !== undefined).join("\n");

  await sendViaSMTP({ to, subject, html, text });
}

/* ══════════════════════════════════════════════════════════
   HTML / TEXT BUILDERS  (shared by both Resend and SMTP)
══════════════════════════════════════════════════════════ */
function buildReportHtml({ heading, status, reportId, comment }) {
  const title = heading || "Facilities concern submitted to BFMO";
  const statusMessage =
    status === "Waiting for Materials"
      ? "is currently queued for action and is waiting for the necessary materials."
      : status === "In Progress"
      ? "is currently in progress and is being attended to by our personnel."
      : "has been tagged as resolved based on the verification conducted by our personnel.";

  return `
    <div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#111827;background-color:#f3f4f6;padding:24px">
      <div style="max-width:640px;margin:0 auto;background-color:#ffffff;border-radius:8px;padding:24px;box-shadow:0 10px 25px rgba(15,23,42,0.08)">
        <h1 style="margin:0;font-size:18px;font-weight:600;color:#111827">BFMO Reports System</h1>
        <p style="margin:4px 0 0;font-size:13px;color:#6b7280">Report status notification</p>
        <p style="margin-top:16px">Good day,</p>
        <p style="margin:0 0 12px">We are writing to inform you that the status of your facilities concern submitted through the BFMO Reports System has been updated.</p>
        <div style="margin:16px 0;padding:12px 16px;border-radius:8px;background-color:#eff6ff;border:1px solid #dbeafe">
          <p style="margin:0 0 4px;font-size:13px;color:#6b7280">Report</p>
          <p style="margin:0 0 8px;font-weight:600">${title}</p>
          <p style="margin:0;font-size:13px;color:#374151">
            Current status:
            <span style="display:inline-block;margin-left:4px;padding:2px 8px;border-radius:999px;background-color:#1d4ed8;color:#fff;font-size:12px;font-weight:500">${status}</span>
          </p>
        </div>
        <p style="margin:0 0 12px">Your report ${statusMessage}</p>
        ${reportId ? `<p style="margin:0 0 12px;font-size:13px;color:#4b5563">Report reference ID: <strong>${reportId}</strong></p>` : ""}
        ${comment ? `
          <div style="margin:16px 0;padding:12px 16px;border-radius:8px;background-color:#f9fafb;border:1px solid #e5e7eb">
            <p style="margin:0 0 4px;font-size:13px;color:#6b7280">Additional note from BFMO</p>
            <p style="margin:0;font-size:14px;color:#111827">${comment}</p>
          </div>
        ` : ""}
        <p style="margin:0 0 12px">If you have additional information or follow up concerns, you may reply to this email or coordinate directly with the BFMO office.</p>
        <p style="margin:0 0 4px">Thank you.</p>
        <p style="margin:0">BFMO Reports System</p>
      </div>
    </div>
  `;
}

function buildReportText({ heading, status, reportId, comment }) {
  const title = heading || "Facilities concern submitted to BFMO";
  const statusMessage =
    status === "Waiting for Materials"
      ? "is currently queued for action and is waiting for the necessary materials."
      : status === "In Progress"
      ? "is currently in progress and is being attended to by our personnel."
      : "has been tagged as resolved based on the verification conducted by our personnel.";

  return [
    "Good day,",
    "",
    "We are writing to inform you that the status of your facilities concern submitted through the BFMO Reports System has been updated.",
    "",
    `Report: ${title}`,
    `Current status: ${status}`,
    "",
    `Your report ${statusMessage}`,
    reportId ? `Report reference ID: ${reportId}` : "",
    comment ? `\nAdditional note from BFMO:\n${comment}` : "",
    "",
    "If you have additional information or follow up concerns, you may reply to this email or coordinate directly with the BFMO office.",
    "",
    "Thank you.",
    "BFMO Reports System",
  ].filter(l => l !== undefined).join("\n");
}

/* ══════════════════════════════════════════════════════════
   EXPORTS
══════════════════════════════════════════════════════════ */
module.exports = {
  sendReportStatusEmail,
  sendTaskNotificationEmail,
};