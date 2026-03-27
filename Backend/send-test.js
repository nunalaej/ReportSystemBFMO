/**
 * send-test.js
 * Test Mailjet email sending locally
 */

require("dotenv").config();
const https = require("https");

const { MJ_APIKEY_PUBLIC, MJ_APIKEY_PRIVATE, FROM_EMAIL } = process.env;

console.log("🧪 Testing Mailjet...\n");

// Check credentials
if (!MJ_APIKEY_PUBLIC || !MJ_APIKEY_PRIVATE) {
  console.error("❌ Missing MJ_APIKEY_PUBLIC or MJ_APIKEY_PRIVATE in .env");
  process.exit(1);
}

if (!FROM_EMAIL) {
  console.error("❌ Missing FROM_EMAIL in .env");
  process.exit(1);
}

console.log("✅ Credentials found");
console.log("FROM_EMAIL:", FROM_EMAIL);
console.log("\n📤 Sending test email...\n");

// Create Basic Auth
const auth = Buffer.from(
  `${MJ_APIKEY_PUBLIC}:${MJ_APIKEY_PRIVATE}`
).toString("base64");

// Email data
const emailData = JSON.stringify({
  Messages: [
    {
      From: {
        Email: FROM_EMAIL,
        Name: "BFMO Test",
      },
      To: [
        {
          Email: "ney1673@dlsud.edu.ph",
          Name: "DLSUD User",
        },
      ],
      Subject: "Test from BFMO Reports",
      TextPart: "This is a test email from BFMO Reports system.",
      HTMLPart:
        "<h3>Test Email</h3><p>If you receive this, Mailjet is working!</p>",
    },
  ],
});

// Send request
const options = {
  hostname: "api.mailjet.com",
  port: 443,
  path: "/v3.1/send",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(emailData),
    Authorization: `Basic ${auth}`,
  },
};

const req = https.request(options, (res) => {
  let data = "";

  res.on("data", (chunk) => {
    data += chunk;
  });

  res.on("end", () => {
    console.log("Status Code:", res.statusCode);
    console.log("\nResponse:");

    try {
      const parsed = JSON.parse(data);
      console.log(JSON.stringify(parsed, null, 2));

      if (res.statusCode === 200 && parsed.Messages) {
        const msg = parsed.Messages[0];
        if (msg.Status === "success") {
          console.log("\n✅ SUCCESS! Message ID:", msg.ID);
        } else {
          console.log("\n⚠️  Status:", msg.Status);
        }
      }
    } catch (err) {
      console.log(data);
    }
  });
});

req.on("error", (err) => {
  console.error("\n❌ Error:", err.message);
});

req.write(emailData);
req.end();