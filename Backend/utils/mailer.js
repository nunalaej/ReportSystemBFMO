// Backend/utils/mailer.js
// ─────────────────────────────────────────────────────────────────────────────
// SMTP ONLY mailer - uses Gmail SMTP to send emails (can reach ANY email)
// ─────────────────────────────────────────────────────────────────────────────

const nodemailer = require("nodemailer");

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

/* ══════════════════════════════════════════════════════════
   SMTP TRANSPORTER
══════════════════════════════════════════════════════════ */
let _smtpTransporter = null;

function getSmtpTransporter() {
  if (_smtpTransporter) return _smtpTransporter;
  
  if (!SMTP_USER || !SMTP_PASS) {
    console.warn("[Mailer] SMTP_USER or SMTP_PASS not set — emails will be skipped.");
    return null;
  }
  
  _smtpTransporter = nodemailer.createTransport({
    host: SMTP_HOST || "smtp.gmail.com",
    port: parseInt(SMTP_PORT || "587", 10),
    secure: parseInt(SMTP_PORT || "587", 10) === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
  
  // Verify connection
  _smtpTransporter.verify((error, success) => {
    if (error) {
      console.error("[Mailer] SMTP connection error:", error);
    } else {
      console.log("[Mailer] SMTP server is ready to send emails");
    }
  });
  
  return _smtpTransporter;
}

async function sendViaSMTP({ to, subject, html, text, replyTo }) {
  const transporter = getSmtpTransporter();
  
  if (!transporter) {
    console.log(`[Mailer/SMTP] Skipped (no SMTP config): "${subject}" → ${to}`);
    return false;
  }
  
  if (!to) {
    console.warn("[Mailer/SMTP] No recipient email provided");
    return false;
  }
  
  try {
    const from = SMTP_FROM || `BFMO System <${SMTP_USER}>`;
    const mailOptions = {
      from,
      to,
      subject,
      html,
      text,
    };
    
    if (replyTo) {
      mailOptions.replyTo = replyTo;
    }
    
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Mailer/SMTP] Sent "${subject}" → ${to} (${info.messageId})`);
    return true;
  } catch (err) {
    console.error(`[Mailer/SMTP] Failed to send "${subject}" → ${to}:`, err.message);
    return false;
  }
}

/* ══════════════════════════════════════════════════════════
   REPORT STATUS EMAIL
══════════════════════════════════════════════════════════ */
async function sendReportStatusEmail({ to, heading, status, reportId, comment }) {
  console.log("[Mailer] sendReportStatusEmail called with:", { to, heading, status, reportId });
  
  if (!to || !status) {
    console.warn("[Mailer] Missing 'to' or 'status', aborting email.");
    return false;
  }
  
  // Allowed statuses that trigger emails
  const allowedStatuses = ["Pending Inspect", "In Progress", "Resolved", "Archived", "Closed"];
  if (!allowedStatuses.includes(status)) {
    console.log(`[Mailer] Status '${status}' not in allowed list — skipping.`);
    return false;
  }
  
  const subject = `BFMO Report Update: ${status}`;
  const title = heading || "Facilities concern submitted to BFMO";
  const htmlBody = buildReportHtml({ heading: title, status, reportId, comment });
  const textBody = buildReportText({ heading: title, status, reportId, comment });
  
  return await sendViaSMTP({
    to,
    subject,
    html: htmlBody,
    text: textBody,
    replyTo: "bfmodlsud@gmail.com",
  });
}

/* ══════════════════════════════════════════════════════════
   TASK NOTIFICATION EMAIL
══════════════════════════════════════════════════════════ */
async function sendTaskNotificationEmail({ to, taskName, status, priority, dueDate, message }) {
  if (!to) {
    console.warn("[Mailer] No recipient for task notification");
    return false;
  }
  
  const subject = `[BFMO Task] ${message?.slice(0, 60) || `Task Update: ${taskName}`}`;
  const dueDateStr = dueDate
    ? new Date(dueDate).toLocaleDateString("en-PH", { dateStyle: "medium" })
    : "No due date set";
  
  const html = `
    <div style="font-family:system-ui,sans-serif;font-size:14px;color:#111827;background:#f3f4f6;padding:24px">
      <div style="max-width:580px;margin:0 auto;background:#fff;border-radius:8px;padding:24px;box-shadow:0 4px 16px rgba(0,0,0,0.08)">
        <div style="text-align:center;margin-bottom:20px">
          <img src="https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME || 'default'}/image/upload/v1/logo-dlsud" alt="BFMO Logo" style="height:50px;width:auto" onerror="this.style.display='none'"/>
        </div>
        <h1 style="margin:0 0 4px;font-size:18px;font-weight:700;color:#029006">BFMO Task Notification</h1>
        <p style="margin:0 0 16px;font-size:13px;color:#6b7280">Automated task update</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin-bottom:16px"/>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px;margin-bottom:16px">
          <p style="margin:0 0 6px"><strong>Task:</strong> ${escapeHtml(taskName)}</p>
          <p style="margin:0 0 6px"><strong>Status:</strong> ${status || "Pending"}</p>
          <p style="margin:0 0 6px"><strong>Priority:</strong> ${priority || "—"}</p>
          <p style="margin:0"><strong>Due Date:</strong> ${dueDateStr}</p>
        </div>
        ${message ? `
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;margin-bottom:16px;color:#dc2626">
            <strong>⚠️ ${escapeHtml(message)}</strong>
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
    "",
    "This is an automated notification from the BFMO Report System.",
  ].filter(l => l !== undefined).join("\n");
  
  return await sendViaSMTP({ to, subject, html, text });
}

/* ══════════════════════════════════════════════════════════
   HTML / TEXT BUILDERS
══════════════════════════════════════════════════════════ */
function buildReportHtml({ heading, status, reportId, comment }) {
  const title = heading || "Facilities concern submitted to BFMO";
  
  let statusMessage = "";
  let statusColor = "";
  
  switch (status) {
    case "Pending Inspect":
      statusMessage = "is currently queued for inspection and initial assessment.";
      statusColor = "#FFD700";
      break;
    case "In Progress":
      statusMessage = "is currently in progress and is being attended to by our personnel.";
      statusColor = "#4169E1";
      break;
    case "Resolved":
      statusMessage = "has been tagged as resolved based on the verification conducted by our personnel.";
      statusColor = "#28A745";
      break;
    case "Archived":
      statusMessage = "has been archived. If you have additional concerns, please submit a new report.";
      statusColor = "#6C757D";
      break;
    case "Closed":
      statusMessage = "has been closed. Thank you for your report.";
      statusColor = "#64748b";
      break;
    default:
      statusMessage = "has been updated.";
      statusColor = "#FFA500";
  }
  
  return `
    <div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#111827;background-color:#f3f4f6;padding:24px">
      <div style="max-width:640px;margin:0 auto;background-color:#ffffff;border-radius:8px;padding:24px;box-shadow:0 10px 25px rgba(15,23,42,0.08)">
        <div style="text-align:center;margin-bottom:20px">
          <img src="https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME || 'default'}/image/upload/v1/logo-dlsud" alt="BFMO Logo" style="height:60px;width:auto" onerror="this.style.display='none'"/>
        </div>
        <h1 style="margin:0;font-size:18px;font-weight:600;color:#111827">BFMO Reports System</h1>
        <p style="margin:4px 0 0;font-size:13px;color:#6b7280">Report status notification</p>
        <p style="margin-top:16px">Good day,</p>
        <p style="margin:0 0 12px">We are writing to inform you that the status of your facilities concern submitted through the BFMO Reports System has been updated.</p>
        <div style="margin:16px 0;padding:12px 16px;border-radius:8px;background-color:#eff6ff;border:1px solid #dbeafe">
          <p style="margin:0 0 4px;font-size:13px;color:#6b7280">Report</p>
          <p style="margin:0 0 8px;font-weight:600">${escapeHtml(title)}</p>
          <p style="margin:0;font-size:13px;color:#374151">
            Current status:
            <span style="display:inline-block;margin-left:4px;padding:2px 8px;border-radius:999px;background-color:${statusColor};color:#fff;font-size:12px;font-weight:500">${status}</span>
          </p>
        </div>
        <p style="margin:0 0 12px">Your report ${statusMessage}</p>
        ${reportId ? `<p style="margin:0 0 12px;font-size:13px;color:#4b5563">Report reference ID: <strong>${reportId}</strong></p>` : ""}
        ${comment ? `
          <div style="margin:16px 0;padding:12px 16px;border-radius:8px;background-color:#f9fafb;border:1px solid #e5e7eb">
            <p style="margin:0 0 4px;font-size:13px;color:#6b7280">Additional note from BFMO</p>
            <p style="margin:0;font-size:14px;color:#111827">${escapeHtml(comment)}</p>
          </div>
        ` : ""}
        <p style="margin:0 0 12px">If you have additional information or follow up concerns, you may reply to this email or coordinate directly with the BFMO office.</p>
        <p style="margin:0 0 4px">Thank you.</p>
        <p style="margin:0">BFMO Reports System</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0 8px"/>
        <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center">
          Building Facilities Maintenance Office<br/>
          De La Salle University - Dasmariñas
        </p>
      </div>
    </div>
  `;
}

function buildReportText({ heading, status, reportId, comment }) {
  const title = heading || "Facilities concern submitted to BFMO";
  
  let statusMessage = "";
  switch (status) {
    case "Pending Inspect":
      statusMessage = "is currently queued for inspection and initial assessment.";
      break;
    case "In Progress":
      statusMessage = "is currently in progress and is being attended to by our personnel.";
      break;
    case "Resolved":
      statusMessage = "has been tagged as resolved based on the verification conducted by our personnel.";
      break;
    case "Archived":
      statusMessage = "has been archived. If you have additional concerns, please submit a new report.";
      break;
    case "Closed":
      statusMessage = "has been closed. Thank you for your report.";
      break;
    default:
      statusMessage = "has been updated.";
  }
  
  return [
    "BFMO Reports System",
    "",
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
    "",
    "Building Facilities Maintenance Office",
    "De La Salle University - Dasmariñas",
  ].filter(l => l !== undefined && l !== "").join("\n");
}

// Helper function to escape HTML
function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ══════════════════════════════════════════════════════════
   EXPORTS
══════════════════════════════════════════════════════════ */
module.exports = {
  sendReportStatusEmail,
  sendTaskNotificationEmail,
};