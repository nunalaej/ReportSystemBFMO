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

/* GET /api/staff/by-clerk/:clerkId */
router.get("/by-clerk/:clerkId", async (req, res) => {
  try {
    const s = await Staff.findOne({ clerkId: req.params.clerkId }).lean();
    if (!s) return res.status(404).json({ success: false, message: "No staff record linked." });
    return res.json({ success: true, staff: s });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Error." });
  }
});

/* GET /api/staff/by-email/:email */
router.get("/by-email/:email", async (req, res) => {
  try {
    const s = await Staff.findOne({ email: req.params.email.toLowerCase().trim() }).lean();
    if (!s) return res.status(404).json({ success: false, message: "No staff record found." });
    return res.json({ success: true, staff: s });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Error." });
  }
});

/* ✅ POST /api/staff/create-clerk — MUST be before /:id routes */
router.post("/create-clerk", async (req, res) => {
  try {
    const { staffId, username, password, name } = req.body;

    if (!username?.trim()) {
      return res.status(400).json({ success: false, message: "Username is required." });
    }
    if (!password?.trim()) {
      return res.status(400).json({ success: false, message: "Password is required." });
    }
    if (password.trim().length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters." });
    }

    const parts     = (name || "").trim().split(" ");
    const firstName = parts[0] || username;
    const lastName  = parts.slice(1).join(" ") || "";

    // Create Clerk user via Clerk Backend API
    const clerkRes = await fetch("https://api.clerk.com/v1/users", {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${process.env.CLERK_SECRET_KEY}`,
      },
      body: JSON.stringify({
        username:        username.trim(),
        password:        password.trim(),
        first_name:      firstName,
        last_name:       lastName,
        public_metadata: { role: "staff" }, // ✅ auto-assign staff role
      }),
    });

    const clerkData = await clerkRes.json();

    if (!clerkRes.ok) {
      const errMsg = clerkData?.errors?.[0]?.long_message
        || clerkData?.errors?.[0]?.message
        || "Failed to create Clerk account.";
      return res.status(400).json({ success: false, message: errMsg });
    }

    const clerkId = clerkData.id;

    // Link clerkId and clerkUsername to Staff record in MongoDB
    if (staffId) {
      await Staff.findByIdAndUpdate(staffId, {
        $set: { clerkId, clerkUsername: username.trim() }
      });
    }

    return res.status(201).json({
      success: true,
      clerkId,
      message: `Account "${username}" created successfully.`,
    });
  } catch (err) {
    console.error("POST /staff/create-clerk:", err);
    return res.status(500).json({ success: false, message: "Server error creating account." });
  }
});

/* ✅ POST /api/staff/link-clerk */
router.post("/link-clerk", async (req, res) => {
  try {
    const { clerkId, username, email } = req.body;
    if (!clerkId) return res.status(400).json({ success: false, message: "clerkId is required." });

    let staff = null;
    if (email)    staff = await Staff.findOne({ email: email.toLowerCase().trim() });
    if (!staff && username) staff = await Staff.findOne({ clerkUsername: username.trim() });
    if (!staff && username) staff = await Staff.findOne({
      name: { $regex: new RegExp(`^${username.trim()}$`, "i") }
    });

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "No staff record found for this account. Contact your administrator.",
      });
    }

    if (!staff.active) {
      return res.status(403).json({
        success: false,
        message: "This staff account is inactive. Contact your administrator.",
      });
    }

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

/* ✅ POST /api/staff/reset-password */
router.post("/reset-password", async (req, res) => {
  try {
    const { clerkId, newPassword } = req.body;
    if (!clerkId || !newPassword) {
      return res.status(400).json({ success: false, message: "clerkId and newPassword required." });
    }

    const clerkRes = await fetch(`https://api.clerk.com/v1/users/${clerkId}`, {
      method:  "PATCH",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${process.env.CLERK_SECRET_KEY}`,
      },
      body: JSON.stringify({ password: newPassword }),
    });

    const data = await clerkRes.json();
    if (!clerkRes.ok) {
      return res.status(400).json({ success: false, message: data?.errors?.[0]?.message || "Failed." });
    }

    return res.json({ success: true, message: "Password reset successfully." });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

/* GET /api/staff/:id — MUST be after named routes */
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
    const { name, email, phone, position, disciplines, active, clerkId, clerkUsername, notes } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: "Name is required." });
    const member = await Staff.create({
      name:          name.trim(),
      email:         (email         || "").trim().toLowerCase(),
      phone:         (phone         || ""),
      position:      (position      || "Staff Engineer"),
      disciplines:   Array.isArray(disciplines) ? disciplines.map(d => String(d).trim()).filter(Boolean) : [],
      active:        active !== false,
      clerkId:       (clerkId       || "").trim(),
      clerkUsername: (clerkUsername || "").trim(), // ✅ ADD THIS
      notes:         (notes         || "").trim(),
    });
    return res.status(201).json({ success: true, staff: member });
  } catch (err) {
    console.error("POST /staff:", err);
    return res.status(500).json({ success: false, message: "Failed to create." });
  }
});

/* PUT /api/staff/:id */
router.put("/:id", async (req, res) => {
  try {
    const { name, email, phone, position, disciplines, active, notes, clerkUsername, clerkId } = req.body;

    const member = await Staff.findById(req.params.id);
    if (!member) return res.status(404).json({ success: false, message: "Staff not found." });

    if (name          !== undefined) member.name          = String(name).trim();
    if (email         !== undefined) member.email         = String(email).trim().toLowerCase();
    if (phone         !== undefined) member.phone         = phone;
    if (position      !== undefined) member.position      = position;
    if (disciplines   !== undefined) member.disciplines   = Array.isArray(disciplines) ? disciplines.map(d => String(d).trim()).filter(Boolean) : [];
    if (active        !== undefined) member.active        = active;
    if (notes         !== undefined) member.notes         = notes;
    if (clerkUsername !== undefined) member.clerkUsername = String(clerkUsername).trim();
    if (clerkId       !== undefined) member.clerkId       = String(clerkId).trim();

    const updated = await member.save();
    return res.json({ success: true, staff: updated });
  } catch (err) {
    console.error("PUT /staff/:id:", err);
    return res.status(500).json({ success: false, message: "Failed to update staff." });
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