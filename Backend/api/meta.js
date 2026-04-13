// Backend/api/meta.js

const express = require("express");
const router  = express.Router();
const Meta    = require("../models/Meta");

/* ── Default data ─────────────────────────────────────────── */
const DEFAULT_BUILDINGS = [
  { id: "ayuntamiento", name: "Ayuntamiento", floors: 4, roomsPerFloor: [20,20,20,20], hasRooms: false },
  { id: "jfh",          name: "JFH",          floors: 4, roomsPerFloor: [10,10,10,10], hasRooms: true  },
  { id: "ictc",         name: "ICTC",          floors: 2, roomsPerFloor: [13,13],       hasRooms: true  },
  { id: "pch",          name: "PCH",           floors: 3, roomsPerFloor: [10,10,10],    hasRooms: true  },
  { id: "food-square",  name: "Food Square",   floors: 1, roomsPerFloor: [20],          hasRooms: false },
  { id: "cos",          name: "COS",           floors: 1, roomsPerFloor: [10],          hasRooms: true  },
  { id: "cbaa",         name: "CBAA",          floors: 4, roomsPerFloor: [10,10,10,10], hasRooms: true  },
  { id: "cthm",         name: "CTHM",          floors: 4, roomsPerFloor: [10,10,10,10], hasRooms: true  },
  { id: "gmh",          name: "GMH",           floors: 2, roomsPerFloor: [6,6],         hasRooms: true  },
  { id: "ceat",         name: "CEAT",          floors: 4, roomsPerFloor: [10,10,10,10], hasRooms: true  },
  { id: "other",        name: "Other",         floors: 1, roomsPerFloor: [1],           hasRooms: false },
];

const DEFAULT_CONCERNS = [
  { id: "electrical",    label: "Electrical",    subconcerns: ["Lights","Aircons","Wires","Outlets","Switches","Other"] },
  { id: "civil",         label: "Civil",         subconcerns: ["Walls","Ceilings","Cracks","Doors","Windows","Other"] },
  { id: "mechanical",    label: "Mechanical",    subconcerns: ["TV","Projectors","Fans","Elevators","Other"] },
  { id: "safety-hazard", label: "Safety Hazard", subconcerns: ["Spikes","Open Wires","Blocked Exits","Wet Floor","Other"] },
  { id: "other",         label: "Other",         subconcerns: ["Other"] },
];

/* ── Helpers ──────────────────────────────────────────────── */

const norm = (v) => (v == null ? "" : String(v).trim().toLowerCase());

function normaliseRoomsPerFloor(raw, floors) {
  let arr;
  if (Array.isArray(raw)) {
    arr = raw.map((v) => {
      const n = parseInt(v, 10);
      return Number.isNaN(n) || n < 1 ? 1 : n;
    });
  } else {
    const flat  = parseInt(raw, 10);
    const count = Number.isNaN(flat) || flat < 1 ? 1 : flat;
    arr = Array.from({ length: floors }, () => count);
  }
  while (arr.length < floors) arr.push(arr[arr.length - 1] ?? 1);
  return arr.slice(0, floors);
}

function sanitiseBuilding(b, idx) {
  const name = String(b?.name || "").trim();
  if (!name) return null;

  const id =
    String(b?.id || "").trim() ||
    norm(name).replace(/\s+/g, "-") ||
    `b-${idx}-${Math.random().toString(36).slice(2, 6)}`;

  const hasRooms            = b?.hasRooms === false ? false : true;
  const floors              = Math.max(1, parseInt(b?.floors, 10) || 1);
  const roomsPerFloor       = normaliseRoomsPerFloor(b?.roomsPerFloor, floors);
  const singleLocationLabel = String(b?.singleLocationLabel || "").trim();

  return { id, name, floors, roomsPerFloor, hasRooms, singleLocationLabel };
}

function sanitiseConcern(c, idx) {
  const label = String(c?.label || "").trim();
  if (!label) return null;

  const id =
    String(c?.id || "").trim() ||
    norm(label).replace(/\s+/g, "-") ||
    `concern-${idx}-${Math.random().toString(36).slice(2, 6)}`;

  let subs = Array.isArray(c?.subconcerns)
    ? c.subconcerns.map((s) => String(s || "").trim()).filter(Boolean)
    : [];

  // "Other" always last, no duplicates
  subs = subs.filter((s) => norm(s) !== "other");
  subs.push("Other");

  return { id, label, subconcerns: subs };
}

/* ── GET /api/meta ────────────────────────────────────────── */
router.get("/", async (req, res) => {
  try {
    let doc = await Meta.findOne({ key: "main" }).lean();

    if (!doc || !doc.buildings?.length) {
      // Seed defaults on first access
      doc = await Meta.findOneAndUpdate(
        { key: "main" },
        { $setOnInsert: { buildings: DEFAULT_BUILDINGS, concerns: DEFAULT_CONCERNS } },
        { upsert: true, returnDocument: "after" }   // ← no more `new: true`
      ).lean();
    }

    return res.json({
      success:   true,
      buildings: doc.buildings || DEFAULT_BUILDINGS,
      concerns:  doc.concerns  || DEFAULT_CONCERNS,
    });
  } catch (err) {
    console.error("GET /meta error:", err);
    return res.status(500).json({ success: false, message: "Failed to load meta." });
  }
});

/* ── PUT /api/meta ────────────────────────────────────────── */
router.put("/", async (req, res) => {
  try {
    const rawBuildings = Array.isArray(req.body?.buildings) ? req.body.buildings : [];
    const rawConcerns  = Array.isArray(req.body?.concerns)  ? req.body.concerns  : [];

    /* Sanitise buildings */
    let buildings = rawBuildings.map((b, i) => sanitiseBuilding(b, i)).filter(Boolean);

    const otherBuildings  = buildings.filter((b) => norm(b.name) === "other");
    const normalBuildings = buildings.filter((b) => norm(b.name) !== "other");
    if (otherBuildings.length === 0) {
      normalBuildings.push({
        id: "other", name: "Other", floors: 1,
        roomsPerFloor: [1], hasRooms: false, singleLocationLabel: "",
      });
    }
    buildings = [...normalBuildings, ...otherBuildings.slice(0, 1)];

    /* Sanitise concerns */
    let concerns = rawConcerns.map((c, i) => sanitiseConcern(c, i)).filter(Boolean);

    const otherConcerns  = concerns.filter((c) => norm(c.label) === "other");
    const normalConcerns = concerns.filter((c) => norm(c.label) !== "other");
    if (otherConcerns.length === 0) {
      normalConcerns.push({ id: "other", label: "Other", subconcerns: ["Other"] });
    }
    concerns = [...normalConcerns, ...otherConcerns.slice(0, 1)];

    /* Upsert */
    const updated = await Meta.findOneAndUpdate(
      { key: "main" },
      { $set: { buildings, concerns } },
      { upsert: true, returnDocument: "after" }    // ← no more `new: true`
    ).lean();

    return res.json({
      success:   true,
      buildings: updated.buildings,
      concerns:  updated.concerns,
    });
  } catch (err) {
    console.error("PUT /meta error:", err);
    return res.status(500).json({ success: false, message: "Failed to save meta." });
  }
});

module.exports = router;