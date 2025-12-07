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
    const title = heading || "Facilities concern submitted to BFMO";

    const statusMessage =
      status === "Waiting for Materials"
        ? "is currently queued for action and is waiting for the necessary materials."
        : status === "In Progress"
        ? "is currently in progress and is being attended to by our personnel."
        : "has been tagged as resolved based on the verification conducted by our personnel.";

    const reportRefText = reportId ? `Report reference ID: ${reportId}\n` : "";

    const textBody = [
      "Good day,",
      "",
      "We are writing to inform you that the status of your facilities concern submitted through the BFMO Reports System has been updated.",
      "",
      `Report: ${title}`,
      `Current status: ${status}`,
      "",
      `Your report ${statusMessage}`,
      reportRefText,
      "If you have additional information or follow up concerns, you may reply to this email or coordinate directly with the BFMO office.",
      "",
      "Thank you.",
      "BFMO Reports System",
    ]
      .filter(Boolean)
      .join("\n");

    const htmlBody = `
      <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; color: #111827; background-color: #f3f4f6; padding: 24px;">
        <div style="max-width: 640px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; padding: 24px; box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08);">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
            <div>
              <h1 style="margin: 0; font-size: 18px; font-weight: 600; color: #111827;">BFMO Reports System</h1>
              <p style="margin: 4px 0 0; font-size: 13px; color: #6b7280;">Report status notification</p>
            </div>
          </div>

          <p style="margin-top: 16px;">Good day,</p>

          <p style="margin: 0 0 12px;">
            We are writing to inform you that the status of your facilities concern submitted through the BFMO Reports System has been updated.
          </p>

          <div style="margin: 16px 0; padding: 12px 16px; border-radius: 8px; background-color: #eff6ff; border: 1px solid #dbeafe;">
            <p style="margin: 0 0 4px; font-size: 13px; color: #6b7280;">Report</p>
            <p style="margin: 0 0 8px; font-weight: 600;">${title}</p>
            <p style="margin: 0; font-size: 13px; color: #374151;">
              Current status:
              <span style="display: inline-block; margin-left: 4px; padding: 2px 8px; border-radius: 999px; background-color: #1d4ed8; color: #ffffff; font-size: 12px; font-weight: 500;">
                ${status}
              </span>
            </p>
          </div>

          <p style="margin: 0 0 12px;">
            Your report ${statusMessage}
          </p>

          ${
            reportId
              ? `<p style="margin: 0 0 12px; font-size: 13px; color: #4b5563;">
                   Report reference ID: <strong>${reportId}</strong>
                 </p>`
              : ""
          }

          <p style="margin: 0 0 12px;">
            If you have additional information or follow up concerns, you may reply to this email or coordinate directly with the BFMO office.
          </p>

          <p style="margin: 0 0 4px;">Thank you.</p>
          <p style="margin: 0;">BFMO Reports System</p>
        </div>
      </div>
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
