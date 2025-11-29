// Backend/api/meta.js
const mongoose = require("mongoose");

// Concern schema (matches what you already have)
const concernSchema = new mongoose.Schema(
  {
    id: { type: String },
    label: { type: String },
    subconcerns: { type: [String], default: [] },
  },
  { _id: false }
);

// Meta schema pointing to your Buildings&Concern collection
const metaSchema = new mongoose.Schema(
  {
    // use Mixed so it works with existing string array
    // and with future building objects from the Edit page
    buildings: { type: [mongoose.Schema.Types.Mixed], default: [] },

    concerns: { type: [concernSchema], default: [] },
  },
  {
    collection: "Buildings&Concern", // <-- THIS uses your existing collection
    timestamps: true,
  }
);

// Model name can be anything; collection is controlled above
const Meta = mongoose.model("BuildingsAndConcern", metaSchema);

module.exports = Meta;
