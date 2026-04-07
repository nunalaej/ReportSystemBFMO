const express = require("express");
const router = express.Router();
const { getListsForUser, saveListsForUser } = require("../services/listsService");

// GET /api/lists?userId=...
router.get("/", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ success: false, message: "Missing userId" });
    const lists = await getListsForUser(userId);
    return res.json({ lists });
  } catch (err) {
    console.error("GET /lists error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/lists
router.post("/", async (req, res) => {
  try {
    const { userId, lists } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: "Missing userId" });
    if (!Array.isArray(lists)) return res.status(400).json({ success: false, message: "lists must be an array" });
    const doc = await saveListsForUser(userId, lists);
    return res.json({ success: true, doc });
  } catch (err) {
    console.error("POST /lists error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;