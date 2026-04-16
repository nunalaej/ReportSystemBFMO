const express = require("express");
const router  = express.Router();
const Staff   = require("../models/Staff");

/* GET /api/staff */
router.get("/", async (req, res) => {
  try {
    const filter = {};
    if (req.query.all !== "true") filter.active = true;
    if (req.query.discipline) filter.disciplines = req.query.discipline;
    const staff = await Staff.find(filter).sort({ name: 1 }).lean();
    return res.json({ success: true, staff });
  } catch (err) {
    console.error("GET /staff:", err);
    return res.status(500).json({ success: false, message: "Failed to load staff." });
  }
});

/* GET /api/staff/by-clerk/:clerkId — find staff by Clerk user ID */
router.get("/by-clerk/:clerkId", async (req, res) => {
  try {
    const s = await Staff.findOne({ clerkId: req.params.clerkId }).lean();
    if (!s) return res.status(404).json({ success: false, message: "No staff record linked to this account." });
    return res.json({ success: true, staff: s });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Error." });
  }
});

/* GET /api/staff/by-email/:email — find staff by email */
router.get("/by-email/:email", async (req, res) => {
  try {
    const s = await Staff.findOne({ email: req.params.email.toLowerCase().trim() }).lean();
    if (!s) return res.status(404).json({ success: false, message: "No staff record found for this email." });
    return res.json({ success: true, staff: s });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Error." });
  }
});

/* GET /api/staff/:id */
router.get("/:id", async (req, res) => {
  try {
    const s = await Staff.findById(req.params.id).lean();
    if (!s) return res.status(404).json({ success: false, message: "Not found." });
    return res.json({ success: true, staff: s });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Error." });
  }
});

/* POST /api/staff */
router.post("/", async (req, res) => {
  try {
    const { name, email, phone, position, disciplines, active, clerkId, notes } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: "Name is required." });

    const member = await Staff.create({
      name:        name.trim(),
      email:       (email    || "").trim().toLowerCase(),
      phone:       (phone    || ""),
      position:    (position || "Staff Engineer"),
      disciplines: Array.isArray(disciplines) ? disciplines.map(d => String(d).trim()).filter(Boolean) : [],
      active:      active !== false,
      clerkId:     (clerkId || "").trim(),
      notes:       (notes   || "").trim(),
    });
    return res.status(201).json({ success: true, staff: member });
  } catch (err) {
    console.error("POST /staff:", err);
    return res.status(500).json({ success: false, message: "Failed to create." });
  }
});

/* POST /api/staff/link-clerk
   Called after a staff member signs up/logs in via Clerk.
   Matches by email, then saves their clerkId to the Staff record. */
router.post("/link-clerk", async (req, res) => {
  try {
    const { clerkId, email } = req.body;
    if (!clerkId || !email) {
      return res.status(400).json({ success: false, message: "clerkId and email are required." });
    }

    // Find staff by email (case-insensitive)
    const staff = await Staff.findOne({ email: email.toLowerCase().trim() });
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "No staff record found for this email. Contact your administrator.",
      });
    }

    // Link Clerk ID if not already linked
    if (!staff.clerkId) {
      staff.clerkId = clerkId;
      await staff.save();
    }

    return res.json({ success: true, staff });
  } catch (err) {
    console.error("POST /staff/link-clerk:", err);
    return res.status(500).json({ success: false, message: "Failed to link account." });
  }
});

/* PUT /api/staff/:id */
router.put("/:id", async (req, res) => {
  try {
    const { name, email, phone, position, disciplines, active, clerkId, notes } = req.body;
    const update = {};
    if (name        !== undefined) update.name        = String(name).trim();
    if (email       !== undefined) update.email       = String(email).trim().toLowerCase();
    if (phone       !== undefined) update.phone       = String(phone);
    if (position    !== undefined) update.position    = String(position);
    if (disciplines !== undefined) update.disciplines = Array.isArray(disciplines)
      ? disciplines.map(d => String(d).trim()).filter(Boolean) : [];
    if (active      !== undefined) update.active      = Boolean(active);
    if (clerkId     !== undefined) update.clerkId     = String(clerkId).trim();
    if (notes       !== undefined) update.notes       = String(notes).trim();

    const updated = await Staff.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true, runValidators: true }
    ).lean();
    if (!updated) return res.status(404).json({ success: false, message: "Not found." });
    return res.json({ success: true, staff: updated });
  } catch (err) {
    console.error("PUT /staff/:id:", err);
    return res.status(500).json({ success: false, message: "Failed to update." });
  }
});

/* DELETE /api/staff/:id */
router.delete("/:id", async (req, res) => {
  try {
    await Staff.findByIdAndDelete(req.params.id);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to delete." });
  }
});

module.exports = router;