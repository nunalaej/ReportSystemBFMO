// Backend/server.js
const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const listsRouter     = require("./routes/lists");
const liststaskRouter = require("./api/liststask.js");
const staffRouter     = require("./api/user/staff");
const reportsRouter   = require("./api/reports");
const metaRouter      = require("./api/meta");          // handles ALL /api/meta logic (GET + PUT)
const { sendReportStatusEmail } = require("./utils/mailer");

const app = express();

/* -----------------------------------------------
   CORS CONFIG
----------------------------------------------- */
app.use(
  cors({
    origin: "*", // you can restrict this later
  })
);

/* -----------------------------------------------
   BASIC MIDDLEWARE
----------------------------------------------- */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* -----------------------------------------------
   ROUTES
   metaRouter replaces the old inline app.get/put
   "/api/meta" handlers — those used the deprecated
   `new: true` option and were conflicting with the
   router. All meta logic now lives in api/meta.js.
----------------------------------------------- */
app.use("/api/reports",   reportsRouter);
app.use("/api/lists",     listsRouter);
app.use("/api/liststask", liststaskRouter);
app.use("/api/user",      staffRouter);
app.use("/api/meta",      metaRouter);

/* -----------------------------------------------
   MONGODB CONNECTION
----------------------------------------------- */
const mongoUri = process.env.MONGODB_URI;
const dbName   = process.env.MONGODB_NAME;

if (!mongoUri) {
  console.error("Missing MONGODB_URI in environment variables.");
  process.exit(1);
}

mongoose
  .connect(mongoUri, dbName ? { dbName } : undefined)
  .then(() => {
    console.log("MongoDB connected successfully");
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  });

/* -----------------------------------------------
   HEALTH CHECK
----------------------------------------------- */
app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "Backend is running on Render",
    timestamp: new Date().toISOString(),
  });
});

/* -----------------------------------------------
   TEST EMAIL  (dev/debug only)
----------------------------------------------- */
app.get("/api/test-email", async (req, res) => {
  const to = req.query.to;
  if (!to) {
    return res.status(400).json({ success: false, message: "Missing ?to=" });
  }

  try {
    await sendReportStatusEmail({
      to,
      heading: "Test BFMO report",
      status: "Resolved",
      reportId: "TEST-123",
    });
    res.json({ success: true, message: `Attempted to send test email to ${to}` });
  } catch (err) {
    console.error("Test email error:", err);
    res.status(500).json({ success: false, message: "Failed to send test email." });
  }
});

/* -----------------------------------------------
   404 HANDLER  (must be last)
----------------------------------------------- */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl,
  });
});

/* -----------------------------------------------
   START SERVER
----------------------------------------------- */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});