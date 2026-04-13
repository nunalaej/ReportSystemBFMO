// Backend/models/Meta.js

const mongoose = require("mongoose");

const COLLECTION = process.env.MONGODB_META_COLLECTION || "MetaCollection";

/* ── Building subdocument ─────────────────────────────────── */
const BuildingSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    floors: { type: Number, default: 1, min: 1 },

    /**
     * roomsPerFloor can be:
     *   • a flat Number  (legacy / when all floors share the same count)
     *   • an Array of Numbers  (one entry per floor, index 0 = 1st floor)
     *
     * Always stored as Mixed so both shapes round-trip without coercion.
     */
    roomsPerFloor: { type: mongoose.Schema.Types.Mixed, default: 1 },

    hasRooms: { type: Boolean, default: true },
    singleLocationLabel: { type: String, default: "" },
  },
  { _id: false }
);

/* ── Concern subdocument ──────────────────────────────────── */
const ConcernSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    subconcerns: { type: [String], default: [] },
  },
  { _id: false }
);

/* ── Root meta document ───────────────────────────────────── */
const MetaSchema = new mongoose.Schema(
  {
    // Singleton — always upserted with key = "main"
    key: { type: String, default: "main", unique: true, index: true },
    buildings: { type: [BuildingSchema], default: [] },
    concerns: { type: [ConcernSchema], default: [] },
  },
  {
    timestamps: true,
    collection: COLLECTION,
  }
);

module.exports = mongoose.model("Meta", MetaSchema);