const express = require("express");
const router = express.Router();

const { getListsForUser, saveListsForUser } = require("../modules/createlists");

router.get("/", async (req, res) => {
  try {
    const { userId } = req.query;
    const lists = await getListsForUser(userId);
    return res.json(lists);
  } catch (err) {
    console.error("GET /lists error:", err);
    res.status(500).json({ success: false, message: err.message || "Failed to load lists" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { userId, lists } = req.body;
    await saveListsForUser(userId, lists);
    return res.json({ success: true });
  } catch (err) {
    console.error("POST /lists error:", err);
    res.status(500).json({ success: false, message: err.message || "Failed to save lists" });
  }
});