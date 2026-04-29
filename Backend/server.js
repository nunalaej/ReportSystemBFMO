const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();
// After DB connection is established:
require("./jobs/notificationJob");

const listsRouter     = require("./routes/lists");
const liststaskRouter = require("./api/liststask.js");
const staffRouter     = require("./api/staff");
const reportsRouter   = require("./api/reports");
const metaRouter      = require("./api/meta");
const tasksRouter     = require("./api/tasks");
const notificationsRouter = require("./api/notifications");

const { sendReportStatusEmail } = require("./utils/mailer");

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/reports",   reportsRouter);
app.use("/api/lists",     listsRouter);
app.use("/api/liststask", liststaskRouter);
app.use("/api/tasks",     tasksRouter);
app.use("/api/meta",      metaRouter);
app.use("/api/user",      staffRouter);   // keep existing
app.use("/api/staff",     staffRouter);   // ✅ ADD THIS — frontend calls /api/staff
app.use("/api/notifications", notificationsRouter);
app.use("/api/document", require("./routes/document"));

const mongoUri = process.env.MONGODB_URI;
const dbName   = process.env.MONGODB_NAME;

if (!mongoUri) {
  console.error("Missing MONGODB_URI in environment variables.");
  process.exit(1);
}

mongoose
  .connect(mongoUri, dbName ? { dbName } : undefined)
  .then(() => console.log("MongoDB connected successfully"))
  .catch((err) => { console.error("MongoDB connection error:", err.message); process.exit(1); });

app.get("/", (req, res) => {
  res.json({ ok: true, message: "Backend is running on Render", timestamp: new Date().toISOString() });
});

app.get("/api/test-email", async (req, res) => {
  const to = req.query.to;
  if (!to) return res.status(400).json({ success: false, message: "Missing ?to=" });
  try {
    await sendReportStatusEmail({ to, heading: "Test BFMO report", status: "Resolved", reportId: "TEST-123" });
    res.json({ success: true, message: `Attempted to send test email to ${to}` });
  } catch (err) {
    console.error("Test email error:", err);
    res.status(500).json({ success: false, message: "Failed to send test email." });
  }
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found", path: req.originalUrl });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));