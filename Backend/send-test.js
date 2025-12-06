// Backend/send-test.js
/**
 * Test script to send a sample report status email
 * Usage: node send-test.js
 */

require("dotenv").config();
const { sendReportStatusEmail } = require("./utils/mailer");

async function testEmail() {
  console.log("📧 Testing email sending...\n");

  try {
    // Test email data
    const testEmail = {
      to: "ney1673@dlsud.edu.ph", // Send to self by default
      heading: "Test Report - Roof Leakage in Building A",
      status: "In Progress",
      reportId: "65f1a2b3c4d5e6f7g8h9i0j1",
    };

    console.log("Sending test email with:");
    console.log(`  To: ${testEmail.to}`);
    console.log(`  Heading: ${testEmail.heading}`);
    console.log(`  Status: ${testEmail.status}`);
    console.log(`  Report ID: ${testEmail.reportId}`);
    console.log("\n");

    await sendReportStatusEmail(testEmail);

    console.log("✅ Email sent successfully!");
    console.log("\nCheck your inbox at:", testEmail.to);
  } catch (err) {
    console.error("❌ Error sending email:", err.message);
    console.error("\nTroubleshooting:");
    console.error("1. Check SMTP credentials in .env file");
    console.error("2. Verify SMTP_HOST, SMTP_USER, SMTP_PASS are set");
    console.error("3. Ensure Gmail 2-factor auth app password is used (not regular password)");
    console.error("4. Check if 'Less secure app access' is enabled for Gmail");
    process.exit(1);
  }
}

testEmail();
