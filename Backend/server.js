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
   META
--------------------------------*/
import Meta from "./api/meta.js";

// GET /api/meta
app.get("/api/meta", async (req, res) => {
  try {
    let meta = await Meta.findOne();
    if (!meta) {
      // If nothing yet, seed with defaults so AdminEdit loads ok
      meta = await Meta.create({
        buildings: [],   // AdminEdit has its own defaults
        concerns: [],
      });
    }

    res.json({
      success: true,
      buildings: meta.buildings,
      concerns: meta.concerns,
    });
  } catch (err) {
    console.error("GET /api/meta error", err);
    res.status(500).json({
      success: false,
      message: "Failed to load meta.",
    });
  }
});

// PUT /api/meta
app.put("/api/meta", async (req, res) => {
  try {
    const { buildings, concerns } = req.body || {};

    if (!Array.isArray(buildings) || !Array.isArray(concerns)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payload. Expect { buildings: [], concerns: [] }",
      });
    }

    const update = {
      buildings,
      concerns,
    };

    const meta = await Meta.findOneAndUpdate({}, update, {
      new: true,
      upsert: true,
    });

    res.json({
      success: true,
      buildings: meta.buildings,
      concerns: meta.concerns,
    });
  } catch (err) {
    console.error("PUT /api/meta error", err);
    res.status(500).json({
      success: false,
      message: "Failed to save meta.",
    });
  }
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
