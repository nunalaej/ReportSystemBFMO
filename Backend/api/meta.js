const express = require("express");
const router  = express.Router();
const Meta    = require("../models/Meta");

/* ── Default data ─────────────────────────────────────────── */
const DEFAULT_BUILDINGS = [
  { id: "ayuntamiento", name: "Ayuntamiento", floors: 4, roomsPerFloor: [20,20,20,20], hasRooms: false },
  { id: "jfh",          name: "JFH",          floors: 4, roomsPerFloor: [10,10,10,10], hasRooms: true  },
  { id: "ictc",         name: "ICTC",         floors: 2, roomsPerFloor: [13,13],       hasRooms: true  },
  { id: "pch",          name: "PCH",          floors: 3, roomsPerFloor: [10,10,10],    hasRooms: true  },
  { id: "food-square",  name: "Food Square",  floors: 1, roomsPerFloor: [20],          hasRooms: false },
  { id: "cos",          name: "COS",          floors: 1, roomsPerFloor: [10],          hasRooms: true  },
  { id: "cbaa",         name: "CBAA",         floors: 4, roomsPerFloor: [10,10,10,10], hasRooms: true  },
  { id: "cthm",         name: "CTHM",         floors: 4, roomsPerFloor: [10,10,10,10], hasRooms: true  },
  { id: "gmh",          name: "GMH",          floors: 2, roomsPerFloor: [6,6],         hasRooms: true  },
  { id: "ceat",         name: "CEAT",         floors: 4, roomsPerFloor: [10,10,10,10], hasRooms: true  },
  { id: "other",        name: "Other",        floors: 1, roomsPerFloor: [1],           hasRooms: false },
];

const DEFAULT_CONCERNS = [
  { id: "electrical",    label: "Electrical",    subconcerns: ["Lights","Aircons","Wires","Outlets","Switches","Other"] },
  { id: "civil",         label: "Civil",         subconcerns: ["Walls","Ceilings","Cracks","Doors","Windows","Other"] },
  { id: "mechanical",    label: "Mechanical",    subconcerns: ["TV","Projectors","Fans","Elevators","Other"] },
  { id: "safety-hazard", label: "Safety Hazard", subconcerns: ["Spikes","Open Wires","Blocked Exits","Wet Floor","Other"] },
  { id: "other",         label: "Other",         subconcerns: ["Other"] },
];

const DEFAULT_STATUSES = [
  { id: "1", name: "Pending",         color: "#FFA500" },
  { id: "2", name: "Pending Inspect", color: "#FFD700" },
  { id: "3", name: "In Progress",     color: "#4169E1" },
  { id: "4", name: "Resolved",        color: "#28A745" },
  { id: "5", name: "Archived",        color: "#6C757D" },
];

const DEFAULT_PRIORITIES = [
  { id: "1", name: "Low",    color: "#28A745", notifyInterval: "5d" },
  { id: "2", name: "Medium", color: "#FFC107", notifyInterval: "3d" },
  { id: "3", name: "High",   color: "#ce4f01", notifyInterval: "1d" },
  { id: "4", name: "Urgent", color: "#a40010", notifyInterval: "1h" },
];

// ✅ NEW defaults
const DEFAULT_COLLEGES    = ["CICS","COCS","CTHM","CBAA","CLAC","COED","CEAT","CCJE","Staff"];
const DEFAULT_YEAR_LEVELS = ["1st Year","2nd Year","3rd Year","4th Year"];

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
  subs = subs.filter((s) => norm(s) !== "other");
  subs.push("Other");
  return { id, label, subconcerns: subs };
}

function sanitiseStatus(s, idx) {
  const name = String(s?.name || "").trim();
  if (!name) return null;
  return {
    id:    String(s?.id || String(idx + 1)).trim(),
    name,
    color: String(s?.color || "#6C757D").trim(),
  };
}

function sanitisePriority(p, idx) {
  const name = String(p?.name || "").trim();
  if (!name) return null;
  // Accept any interval string: "1h","3d","5d","1d","daily","1week","1month","3months"
  const ni = String(p?.notifyInterval || "").trim();
  const validIntervals = ["hourly","daily","1h","1d","2d","3d","4d","5d","6d","7d","1week","2weeks","1month","3months"];
  const notifyInterval = (ni && /^(\d+)(h|d|w)?$/.test(ni)) || validIntervals.includes(ni) ? ni : "1d";
  return {
    id:             String(p?.id || String(idx + 1)).trim(),
    name,
    color:          String(p?.color || "#6C757D").trim(),
    notifyInterval,
  };
}

/* ── GET /api/meta ────────────────────────────────────────── */
router.get("/", async (req, res) => {
  try {
    let doc = await Meta.findOne({ key: "main" }).lean();

    if (!doc || !doc.buildings?.length) {
      doc = await Meta.findOneAndUpdate(
        { key: "main" },
        {
          $setOnInsert: {
            buildings:  DEFAULT_BUILDINGS,
            concerns:   DEFAULT_CONCERNS,
            statuses:   DEFAULT_STATUSES,
            priorities: DEFAULT_PRIORITIES,
            colleges:   DEFAULT_COLLEGES,      // ✅
            yearLevels: DEFAULT_YEAR_LEVELS,   // ✅
          },
        },
        { upsert: true, returnDocument: "after" }
      ).lean();
    }

    return res.json({
      success:    true,
      buildings:  doc.buildings  || DEFAULT_BUILDINGS,
      concerns:   doc.concerns   || DEFAULT_CONCERNS,
      statuses:   doc.statuses   || DEFAULT_STATUSES,
      priorities: doc.priorities || DEFAULT_PRIORITIES,
      // ✅ Always return with fallback to defaults
      colleges:   doc.colleges   && doc.colleges.length   ? doc.colleges   : DEFAULT_COLLEGES,
      yearLevels: doc.yearLevels && doc.yearLevels.length ? doc.yearLevels : DEFAULT_YEAR_LEVELS,
    });
  } catch (err) {
    console.error("GET /meta error:", err);
    return res.status(500).json({ success: false, message: "Failed to load meta." });
  }
});

/* ── PUT /api/meta ────────────────────────────────────────── */
router.put("/", async (req, res) => {
  try {
    const rawBuildings  = Array.isArray(req.body?.buildings)  ? req.body.buildings  : [];
    const rawConcerns   = Array.isArray(req.body?.concerns)   ? req.body.concerns   : [];
    const rawStatuses   = Array.isArray(req.body?.statuses)   ? req.body.statuses   : [];
    const rawPriorities = Array.isArray(req.body?.priorities) ? req.body.priorities : [];
    // ✅ NEW: read colleges and yearLevels from body
    const rawColleges   = Array.isArray(req.body?.colleges)   ? req.body.colleges   : [];
    const rawYearLevels = Array.isArray(req.body?.yearLevels) ? req.body.yearLevels : [];

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

    /* Sanitise statuses */
    let statuses = rawStatuses.map((s, i) => sanitiseStatus(s, i)).filter(Boolean);
    if (statuses.length === 0) statuses = DEFAULT_STATUSES;

    /* Sanitise priorities */
    let priorities = rawPriorities.map((p, i) => sanitisePriority(p, i)).filter(Boolean);
    if (priorities.length === 0) priorities = DEFAULT_PRIORITIES;

    // ✅ Sanitise colleges — clean strings, fallback to defaults if empty
    const colleges = rawColleges.map(c => String(c || "").trim()).filter(Boolean);
    // ✅ Sanitise yearLevels — clean strings, fallback to defaults if empty
    const yearLevels = rawYearLevels.map(y => String(y || "").trim()).filter(Boolean);

    /* Build update object */
    const setFields = { buildings, concerns, statuses, priorities };
    if (colleges.length)   setFields.colleges   = colleges;
    if (yearLevels.length) setFields.yearLevels = yearLevels;

    /* Upsert */
    const updated = await Meta.findOneAndUpdate(
      { key: "main" },
      { $set: setFields },
      { upsert: true, returnDocument: "after" }
    ).lean();

    return res.json({
      success:    true,
      buildings:  updated.buildings,
      concerns:   updated.concerns,
      statuses:   updated.statuses,
      priorities: updated.priorities,
      colleges:   updated.colleges   && updated.colleges.length   ? updated.colleges   : DEFAULT_COLLEGES,
      yearLevels: updated.yearLevels && updated.yearLevels.length ? updated.yearLevels : DEFAULT_YEAR_LEVELS,
    });
  } catch (err) {
    console.error("PUT /meta error:", err);
    return res.status(500).json({ success: false, message: "Failed to save meta." });
  }
});

module.exports = router;