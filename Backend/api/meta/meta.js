// Backend/api/meta.js
const express = require("express");
const router = express.Router();

// GET /api/meta
router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Meta route working",
    api: "Report System BFMO Backend",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
