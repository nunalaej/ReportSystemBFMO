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
app.use(
  cors({
    origin: "*", // you can restrict this later if needed
  })
);

/* -------------------------------
   BASIC MIDDLEWARE
--------------------------------*/
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* -------------------------------
   ROUTES
--------------------------------*/
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
   404 HANDLER (optional)
--------------------------------*/
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl,
  });
});

/* -------------------------------
   START SERVER
--------------------------------*/
const PORT = process.env.PORT || 5000; // Render will inject PORT
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
