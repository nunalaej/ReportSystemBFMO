// Backend/utils/mailer.js
const nodemailer = require("nodemailer");

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

let _smtpTransporter = null;

function getSmtpTransporter() {
  if (_smtpTransporter) return _smtpTransporter;
  
  if (!SMTP_USER || !SMTP_PASS) {
    console.warn("[Mailer] SMTP credentials missing");
    return null;
  }
  
  _smtpTransporter = nodemailer.createTransport({
    host: SMTP_HOST || "smtp.gmail.com",
    port: parseInt(SMTP_PORT || "587", 10),
    secure: false,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  
  // Verify connection on startup
  _smtpTransporter.verify((error, success) => {
    if (error) {
      console.error("[Mailer] SMTP connection error:", error.message);
    } else {
      console.log("[Mailer] SMTP ready to send emails");
    }
  });
  
  return _smtpTransporter;
}

async function sendReportStatusEmail({ to, heading, status, reportId, comment }) {
  console.log(`[Mailer] Sending to: ${to}, Status: ${status}`);
  
  if (!to || !status) {
    console.warn("[Mailer] Missing email or status");
    return false;
  }

  const subject = `BFMO Report Update: ${status}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
      <div style="background: white; border-radius: 8px; padding: 24px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h1 style="color: #029006; margin: 0 0 8px; font-size: 24px;">BFMO Report System</h1>
        <p style="color: #666; margin-bottom: 24px;">Status Update Notification</p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;">
        
        <p style="font-size: 16px; line-height: 1.5;">Good day,</p>
        
        <p style="font-size: 16px; line-height: 1.5;">
          We are writing to inform you that your facility report 
          <strong>"${heading || "Report"}"</strong> has been updated.
        </p>
        
        <div style="background: #f0f9ff; border-left: 4px solid #029006; padding: 16px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0 0 8px;"><strong>Current Status:</strong></p>
          <p style="margin: 0; font-size: 20px; font-weight: bold; color: #029006;">${status}</p>
        </div>
        
        ${reportId ? `<p style="font-size: 14px; color: #666;">Reference ID: <strong>${reportId}</strong></p>` : ''}
        
        ${comment ? `
          <div style="background: #fef3c7; padding: 12px; border-radius: 4px; margin: 16px 0;">
            <p style="margin: 0; color: #92400e;"><strong>Note from BFMO:</strong> ${comment}</p>
          </div>
        ` : ''}
        
        <p style="font-size: 16px; line-height: 1.5; margin-top: 24px;">
          You can track the progress of your report by logging into the BFMO Student Portal.
        </p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0 16px;">
        
        <p style="font-size: 12px; color: #999; text-align: center;">
          Building Facilities Maintenance Office<br>
          De La Salle University - Dasmariñas
        </p>
      </div>
    </div>
  `;
  
  const text = `
BFMO Report Update: ${status}

Good day,

We are writing to inform you that your facility report "${heading || "Report"}" has been updated.

Current Status: ${status}

${reportId ? `Reference ID: ${reportId}` : ''}
${comment ? `\nNote from BFMO: ${comment}` : ''}

You can track the progress of your report by logging into the BFMO Student Portal.

--
Building Facilities Maintenance Office
De La Salle University - Dasmariñas
  `;

  try {
    const transporter = getSmtpTransporter();
    if (!transporter) return false;
    
    const info = await transporter.sendMail({
      from: SMTP_FROM || `BFMO System <${SMTP_USER}>`,
      to: to,
      subject: subject,
      html: html,
      text: text,
    });
    
    console.log(`[Mailer] ✅ Email sent! Message ID: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`[Mailer] ❌ Failed:`, error.message);
    return false;
  }
}

async function sendTaskNotificationEmail({ to, taskName, status, priority, dueDate, message }) {
  if (!to) return false;
  
  const subject = `[BFMO Task] ${message?.slice(0, 60) || `Task Update: ${taskName}`}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: white; border-radius: 8px; padding: 24px;">
        <h2 style="color: #029006;">BFMO Task Notification</h2>
        <p><strong>Task:</strong> ${taskName}</p>
        <p><strong>Status:</strong> ${status || "Pending"}</p>
        ${priority ? `<p><strong>Priority:</strong> ${priority}</p>` : ''}
        ${message ? `<p><strong>Message:</strong> ${message}</p>` : ''}
        <hr>
        <p style="color: #666; font-size: 12px;">Please log in to the BFMO system for more details.</p>
      </div>
    </div>
  `;
  
  try {
    const transporter = getSmtpTransporter();
    if (!transporter) return false;
    
    await transporter.sendMail({
      from: SMTP_FROM || `BFMO System <${SMTP_USER}>`,
      to: to,
      subject: subject,
      html: html,
    });
    return true;
  } catch (error) {
    console.error(`[Mailer] Task email failed:`, error.message);
    return false;
  }
}

module.exports = {
  sendReportStatusEmail,
  sendTaskNotificationEmail,
};