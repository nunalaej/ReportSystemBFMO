const mongoose = require("mongoose");

const COLLECTION = process.env.MONGODB_META_COLLECTION || "MetaCollection";

/* ── Building subdocument ─────────────────────────────────── */
const BuildingSchema = new mongoose.Schema(
  {
    id:                  { type: String, required: true },
    name:                { type: String, required: true },
    floors:              { type: Number, default: 1, min: 1 },
    roomsPerFloor:       { type: mongoose.Schema.Types.Mixed, default: 1 },
    hasRooms:            { type: Boolean, default: true },
    singleLocationLabel: { type: String, default: "" },
  },
  { _id: false }
);

/* ── Concern subdocument ──────────────────────────────────── */
const ConcernSchema = new mongoose.Schema(
  {
    id:          { type: String, required: true },
    label:       { type: String, required: true },
    subconcerns: { type: [String], default: [] },
  },
  { _id: false }
);

/* ── Status subdocument ───────────────────────────────────── */
const StatusSchema = new mongoose.Schema(
  {
    id:    { type: String, required: true },
    name:  { type: String, required: true },
    color: { type: String, default: "#6C757D" },
  },
  { _id: false }
);

/* ── Priority subdocument ─────────────────────────────────── */
const PrioritySchema = new mongoose.Schema(
  {
    id:             { type: String, required: true },
    name:           { type: String, required: true },
    color:          { type: String, default: "#6C757D" },
    notifyInterval: { type: String, default: "1month" },   // ✅ FIXED: was missing, causing interval to reset
  },
  { _id: false }
);

/* ── Root meta document ───────────────────────────────────── */
const MetaSchema = new mongoose.Schema(
  {
    key:       { type: String, default: "main", unique: true, index: true },
    buildings: { type: [BuildingSchema], default: [] },
    concerns:  { type: [ConcernSchema],  default: [] },
    statuses:  {
      type: [StatusSchema],
      default: [
        { id: "1", name: "Pending",         color: "#FFA500" },
        { id: "2", name: "Pending Inspect", color: "#FFD700" },
        { id: "3", name: "In Progress",     color: "#4169E1" },
        { id: "4", name: "Resolved",        color: "#28A745" },
        { id: "5", name: "Archived",        color: "#6C757D" },
      ],
    },
    priorities: {
      type: [PrioritySchema],
      default: [
        { id: "1", name: "Low",    color: "#28A745", notifyInterval: "3months" },
        { id: "2", name: "Medium", color: "#FFC107", notifyInterval: "1month"  },
        { id: "3", name: "High",   color: "#ce4f01", notifyInterval: "1week"   },
        { id: "4", name: "Urgent", color: "#a40010", notifyInterval: "daily"   },
      ],
    },

    // ✅ NEW: Student Report Settings
    colleges: {
      type:    [String],
      default: ["CICS","COCS","CTHM","CBAA","CLAC","COED","CEAT","CCJE","Staff"],
    },
    yearLevels: {
      type:    [String],
      default: ["1st Year","2nd Year","3rd Year","4th Year"],
    },
  },
  {
    timestamps: true,
    collection: COLLECTION,
  }
);

module.exports = mongoose.model("Meta", MetaSchema);