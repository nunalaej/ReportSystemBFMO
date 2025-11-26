// Backend/server.js
const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const metaRouter = require("./routes/meta");
const reportsRouter = require("./routes/reports");

const app = express();

// CORS – allow your frontend (set CORS_ORIGIN in env)
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : "*",
  })
);

// Basic JSON parsing
app.use(express.json());

// Serve uploaded images
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// MongoDB
const mongoUri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_NAME; // optional if already in URI

if (!mongoUri) {
  console.error("Missing MONGODB_URI");
  process.exit(1);
}

// Important: NO useNewUrlParser/useUnifiedTopology options – those caused your error
mongoose
  .connect(mongoUri, dbName ? { dbName } : undefined)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Routes
app.use("/api/meta", metaRouter);
app.use("/api/reports", reportsRouter);

// Health check
app.get("/", (req, res) => {
  res.json({ ok: true, message: "BFMO backend is running" });
});

// Port
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
