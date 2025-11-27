// Backend/server.js
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import { Report } from "./models/Report.js";

dotenv.config();

const app = express();

// CORS – allow your Vercel frontend and local dev
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.length === 0) {
        return cb(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        return cb(null, true);
      }
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json());

// MongoDB
const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set");
  process.exit(1);
}

mongoose
  .connect(uri)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => {
    console.error("MongoDB error:", err);
    process.exit(1);
  });

// Simple health route
app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "Backend is running on Render",
    timestamp: new Date().toISOString(),
  });
});

/* ----------- API: GET reports ----------- */

app.get("/api/reports", async (req, res) => {
  try {
    const reports = await Report.find().sort({ createdAt: -1 }).lean();
    res.json({ reports });
  } catch (err) {
    console.error("GET /api/reports error:", err);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

/* ----------- API: UPDATE status/comments ----------- */

app.put("/api/reports/:id", async (req, res) => {
  const { id } = req.params;
  const { status, comment, by } = req.body;

  try {
    const update = {};

    if (status) {
      update.status = status;
    }

    // if there is a new comment, push to comments array
    if (comment && comment.trim()) {
      update.$push = {
        comments: {
          text: comment.trim(),
          by: by || "System",
          at: new Date(),
        },
      };
    }

    const updatedReport = await Report.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true, // respects enum on status
    });

    if (!updatedReport) {
      return res.status(404).json({ error: "Report not found" });
    }

    res.json({ report: updatedReport });
  } catch (err) {
    console.error("PUT /api/reports/:id error:", err);
    res.status(500).json({ error: "Failed to update report" });
  }
});

/* ----------- Start server (local dev) ----------- */

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Backend listening on http://localhost:${PORT}`);
  });
}

export default app; // needed for Render / Vercel style deployments
