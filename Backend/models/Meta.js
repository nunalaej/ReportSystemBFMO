// models/Meta.js  (or MetaCollection model)
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
    notifyInterval: { type: String, default: "1month" },
  },
  { _id: false }
);

/* ── Notification rule schedule step ─────────────────────── */
const NotifScheduleStepSchema = new mongoose.Schema(
  {
    phase:    { type: String, default: "" },
    interval: { type: String, default: "" },
  },
  { _id: false }
);

/* ── Notification rule subdocument ───────────────────────── */
const NotifRuleSchema = new mongoose.Schema(
  {
    name:           { type: String, required: true },
    color:          { type: String, default: "#6C757D" },
    maxDuration:    { type: String, default: "7 days" },
    schedule:       { type: [NotifScheduleStepSchema], default: [] },
    unfinishedNote: { type: String, default: "" },
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
        { id: "1", name: "Low",    color: "#28A745", notifyInterval: "5d" },
        { id: "2", name: "Medium", color: "#FFC107", notifyInterval: "3d" },
        { id: "3", name: "High",   color: "#ce4f01", notifyInterval: "1d" },
        { id: "4", name: "Urgent", color: "#a40010", notifyInterval: "1h" },
      ],
    },

    /* ── Student report settings ── */
    colleges: {
      type:    [String],
      default: ["CICS","COCS","CTHM","CBAA","CLAC","COED","CEAT","CCJE","Staff"],
    },
    yearLevels: {
      type:    [String],
      default: ["1st Year","2nd Year","3rd Year","4th Year"],
    },

    /* ✅ FIX 1: Notification rules — was missing, Mongoose was stripping it */
    notifRules: {
      type:    [NotifRuleSchema],
      default: [],
    },

    /* ✅ FIX 2: Position names list — was missing */
    positionOptions: {
      type:    [String],
      default: ["Head Engineer","Staff Engineer","Supervisor","Technician","Other"],
    },

    /* ✅ FIX 3: Discipline names list — was missing */
    disciplineOptions: {
      type:    [String],
      default: ["Electrical","Civil","Mechanical","Safety Hazard"],
    },

    /* ✅ FIX 4: Position permissions map — THIS IS THE ONE CAUSING "View only"
       Mongoose was stripping this field entirely on every GET because it
       wasn't declared in the schema. Staff pages got {} → empty permList
       → buildPerms([]) → BASE_PERMS → "View only" for everyone.
       
       Using Mixed type so any shape like:
         { "Head Engineer": ["Create tasks", "Update status", ...] }
       is stored and returned without restriction. */
    positionPerms: {
      type:    mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: COLLECTION,
  }
);

module.exports = mongoose.model("Meta", MetaSchema);