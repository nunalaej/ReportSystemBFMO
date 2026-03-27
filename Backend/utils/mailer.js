// utils/mailer.js

const Mailjet = require("node-mailjet");

const { MJ_APIKEY_PUBLIC, MJ_APIKEY_PRIVATE, FROM_EMAIL, FROM_NAME } = process.env;

// Initialize Mailjet client
const mailjet = Mailjet.connect(MJ_APIKEY_PUBLIC, MJ_APIKEY_PRIVATE);

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

    if (!MJ_APIKEY_PUBLIC || !MJ_APIKEY_PRIVATE) {
      console.warn(
        "[Mailer] Mailjet API keys are missing. Email not sent."
      );
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

    console.log("[Mailer] Sending request to Mailjet...");

    // Use Mailjet v3.1 API for sending emails
    const request = mailjet
      .post("send", { version: "v3.1" })
      .request({
        Messages: [
          {
            From: {
              Email: FROM_EMAIL || "noreply@bfmo.local",
              Name: FROM_NAME || "BFMO Reports",
            },
            To: [
              {
                Email: to,
              },
            ],
            Subject: subject,
            TextPart: textBody,
            HTMLPart: htmlBody,
            ReplyTo: {
              Email: "bfmodlsud@gmail.com",
            },
          },
        ],
      });

    const result = await request;

    // Check if email was sent successfully
    if (
      result.body &&
      result.body.Messages &&
      result.body.Messages.length > 0
    ) {
      const message = result.body.Messages[0];

      if (message.Status === "success") {
        console.log("[Mailer] Email sent successfully:", {
          messageId: message.ID,
          to,
        });
      } else {
        console.error("[Mailer] Mailjet returned non-success status:", {
          status: message.Status,
          to,
        });
      }
    } else {
      console.error("[Mailer] Unexpected Mailjet response:", result.body);
    }
  } catch (err) {
    console.error("[Mailer] Fatal error sending email:", err);
  }
}

module.exports = {
  sendReportStatusEmail,
};