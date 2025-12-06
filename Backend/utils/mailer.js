// utils/mailer.js
const nodemailer = require("nodemailer");

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  FROM_EMAIL,
} = process.env;

// You can add a simple guard so it is obvious in logs if SMTP is not set
if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
  console.warn(
    "[Mailer] SMTP config is incomplete. Emails will fail unless env vars are set."
  );
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT) || 587,
  secure: false, // 587 usually uses STARTTLS
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

/**
 * Send report status update email
 * Only sends when status is Waiting for Materials, In Progress, or Resolved
 */
async function sendReportStatusEmail({ to, heading, status, reportId }) {
  if (!to || !status) return;

  const allowedStatuses = [
    "Waiting for Materials",
    "In Progress",
    "Resolved",
  ];

  if (!allowedStatuses.includes(status)) return;

  const subject = `BFMO Report Update: ${status}`;
  const title = heading || "Your submitted report";

  const statusMessage =
    status === "Waiting for Materials"
      ? "is currently waiting for materials and is queued for action."
      : status === "In Progress"
      ? "is now in progress and is being worked on by our team."
      : "has been marked as resolved.";

  const reportRefText = reportId
    ? `\n\nReport reference ID: ${reportId}`
    : "";

  const textBody = [
    "Good day,",
    "",
    "This is to inform you that the status of your report has been updated.",
    "",
    `${title}`,
    `Current status: ${status}`,
    "",
    `Your report ${statusMessage}`,
    "If you have any follow-up concerns, you may reply to this message or contact the BFMO office.",
    reportRefText,
    "",
    "Thank you.",
    "BFMO Reports System",
  ]
    .filter(Boolean)
    .join("\n");

  const htmlBody = `
    <p>Good day,</p>
    <p>This is to inform you that the status of your report has been updated.</p>
    <p><strong>${title}</strong><br />
    Current status: <strong>${status}</strong></p>
    <p>Your report ${statusMessage}</p>
    ${
      reportId
        ? `<p>Report reference ID: <strong>${reportId}</strong></p>`
        : ""
    }
    <p>If you have any follow-up concerns, you may reply to this message or contact the BFMO office.</p>
    <p>Thank you.<br />BFMO Reports System</p>
  `;

  await transporter.sendMail({
    from: FROM_EMAIL || SMTP_USER,
    to,
    subject,
    text: textBody,
    html: htmlBody,
  });
}

module.exports = {
  sendReportStatusEmail,
};
