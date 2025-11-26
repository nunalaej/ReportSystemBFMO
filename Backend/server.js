// Backend/server.js
const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

/* -------------------------------
   CORS CONFIG
--------------------------------*/
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : "*",
  })
);

/* -------------------------------
   BASIC MIDDLEWARE
--------------------------------*/
app.use(express.json());

// Serve uploaded files (if you later use /uploads)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));


const metaRouter = require("./api/meta");
const reportsRouter = require("./api/reports");

app.use("/api/meta", metaRouter);
app.use("/api/reports", reportsRouter);

/* -------------------------------
   MONGODB CONNECTION
--------------------------------*/
const mongoUri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_NAME;

if (!mongoUri) {
  console.error("❌ Missing MONGODB_URI in environment variables.");
  process.exit(1);
}

mongoose
  .connect(mongoUri, dbName ? { dbName } : undefined)
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1); // stop server if DB cannot connect
  });

/* -------------------------------
   HEALTH CHECK
--------------------------------*/
app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "Backend is running on Render",
    timestamp: new Date().toISOString(),
  });
});

/* -------------------------------
   START SERVER
--------------------------------*/
const PORT = process.env.PORT || 5000; // Render will inject PORT
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
