// api/lists.js
const express = require("express");
const router = express.Router();

const UserLists = require("../models/UserLists");

/* ============================================================
   GET LISTS FOR A USER
   GET /api/lists?userId=xxx
============================================================ */
router.get("/", async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "Missing userId",
      });
    }

    const doc = await UserLists.findOne({ userId }).lean();

    return res.json(doc?.lists ?? []);
  } catch (err) {
    console.error("GET /lists error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to load lists",
    });
  }
});

/* ============================================================
   SAVE (UPSERT) LISTS FOR A USER
   POST /api/lists  — body: { userId, lists }
============================================================ */
router.post("/", async (req, res) => {
  try {
    const { userId, lists } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "Missing userId",
      });
    }

    if (!Array.isArray(lists)) {
      return res.status(400).json({
        success: false,
        message: "lists must be an array",
      });
    }

    await UserLists.findOneAndUpdate(
      { userId },
      { userId, lists, updatedAt: new Date() },
      { upsert: true, new: true }
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("POST /lists error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to save lists",
    });
  }
});

module.exports = router;