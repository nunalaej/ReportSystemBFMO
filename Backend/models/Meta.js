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

/* ── Default position permissions ────────────────────────── */
// Valid permission strings (must match what the frontend checks):
//   "Create tasks"    → perms.canCreate
//   "Edit tasks"      → perms.canEdit
//   "Assign staff"    → perms.canAssign
//   "Update status"   → perms.canStatus / canUpdateReport / canArchive
//   "Comment"         → perms.canComment
//   "Archive Reports" → stored alongside "Update status" (canArchive also checks "Update status")
//   "View Tasks"      → perms.canViewReports (also implied by "View only")
//   "View only"       → isViewOnly = true (no mutations)
const DEFAULT_POSITION_PERMS = {
  "Head Engineer":  [
    "Create tasks",
    "Edit tasks",
    "Assign staff",
    "Update status",
    "Comment",
    "Archive Reports",
    "View Tasks",
  ],
  "Staff Engineer": [
    "Update status",
    "Comment",
    "View Tasks",
  ],
  "Supervisor": [
    "View Tasks",
    "View only",
  ],
  "Technician": [
    "View Tasks",
    "View only",
  ],
  "Other": [
    "View Tasks",
    "View only",
  ],
};

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

    /* ── Student Report Settings ──────────────────────────── */
    colleges: {
      type:    [String],
      default: ["CICS","COCS","CTHM","CBAA","CLAC","COED","CEAT","CCJE","Staff"],
    },
    yearLevels: {
      type:    [String],
      default: ["1st Year","2nd Year","3rd Year","4th Year"],
    },

    /* ── Staff Settings ───────────────────────────────────── */
    positionOptions: {
      type:    [String],
      default: ["Head Engineer","Staff Engineer","Supervisor","Technician","Other"],
    },
    disciplineOptions: {
      type:    [String],
      default: ["Electrical","Civil","Mechanical","Safety Hazard"],
    },

    /* ── Position-based Permissions ──────────────────────────
       Stored as a plain object: { [positionName]: string[] }
       The frontend (useStaffPerms.ts) reads this and maps the
       permission strings to boolean flags via buildPerms().

       Valid permission strings:
         "Create tasks"    - can create new tasks
         "Edit tasks"      - can edit existing tasks
         "Assign staff"    - can assign staff to tasks
         "Update status"   - can update task/report status + archive
         "Comment"         - can add/edit/delete comments
         "Archive Reports" - explicit archive permission (UI checks "Update status" too)
         "View Tasks"      - can see the tasks list
         "View only"       - read-only; no mutations at all
    ─────────────────────────────────────────────────────────── */
    positionPerms: {
      type:    mongoose.Schema.Types.Mixed,
      default: DEFAULT_POSITION_PERMS,
    },

    /* ── Notification Rules ───────────────────────────────── */
    notifRules: {
      type:    mongoose.Schema.Types.Mixed,
      default: [],
    },
  },
  {
    timestamps: true,
    collection: COLLECTION,
  }
);

module.exports = mongoose.model("Meta", MetaSchema);