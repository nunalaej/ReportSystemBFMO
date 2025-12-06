// utils/mailer.js

const { RESEND_API_KEY, FROM_EMAIL } = process.env;

/**
 * Send report status update email
 * Only sends when status is Waiting for Materials, In Progress, or Resolved
 */
async function sendReportStatusEmail({ to, heading, status, reportId }) {
  console.log("[Mailer] sendReportStatusEmail called with:", {
    to,
    heading,
    status,
    reportId,
  });

  try {
    if (!to || !status) {
      console.warn("[Mailer] Missing 'to' or 'status', aborting email.");
      return;
    }

    const allowedStatuses = [
      "Waiting for Materials",
      "In Progress",
      "Resolved",
    ];

    if (!allowedStatuses.includes(status)) {
      console.log(
        `[Mailer] Status '${status}' not allowed for email sending.`
      );
      return;
    }

    if (!RESEND_API_KEY) {
      console.warn("[Mailer] RESEND_API_KEY is missing. Email not sent.");
      return;
    }

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
      "If you have any follow up concerns, you may reply to this message or contact the BFMO office.",
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
      <p>If you have any follow up concerns, you may reply to this message or contact the BFMO office.</p>
      <p>Thank you.<br />BFMO Reports System</p>
    `;

    console.log("[Mailer] Sending request to Resend...");

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL || "BFMO Reports <onboarding@resend.dev>",
        to: [to],
        subject,
        text: textBody,
        html: htmlBody,
        reply_to: "bfmodlsud@gmail.com",
      }),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      console.error(
        "[Mailer] Resend API error:",
        res.status,
        res.statusText,
        errorText
      );
      return;
    }

    const data = await res.json().catch(() => null);
    console.log("[Mailer] Email sent successfully:", data);
  } catch (err) {
    console.error("[Mailer] Fatal error sending email:", err);
  }
}

module.exports = {
  sendReportStatusEmail,
};
