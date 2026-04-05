const express = require("express");
const router = express.Router();
const Liststask = require("../models/Liststask");

router.get("/", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ success: false, message: "Missing userId" });
    const items = await Liststask.find({ userId }).lean();
    return res.json(items);
  } catch (err) {
    console.error("GET /liststask error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { userId, liststask } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: "Missing userId" });
    if (!liststask || typeof liststask !== "object")
      return res.status(400).json({ success: false, message: "Missing liststask" });

    const doc = new Liststask({ ...liststask, userId });
    await doc.save();
    return res.json({ success: true, item: doc });
  } catch (err) {
    console.error("POST /liststask error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;