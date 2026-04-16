// Backend/models/Staff.js
const mongoose = require("mongoose");

const StaffSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true },
    email:       { type: String, default: "",   trim: true },
    phone:       { type: String, default: "" },
    // "Head Engineer" | "Staff Engineer" | "Supervisor" | "Technician" | "Other"
    position:    { type: String, default: "Staff Engineer" },
    // discipline labels that match concern labels e.g. ["Civil","Mechanical"]
    disciplines: { type: [String], default: [] },
    active:      { type: Boolean, default: true },
    clerkId:     { type: String, default: "" },
    notes:       { type: String, default: "" },
  },
  { timestamps: true, collection: "StaffCollection" }
);

StaffSchema.index({ disciplines: 1 });
StaffSchema.index({ active: 1 });

module.exports = mongoose.model("Staff", StaffSchema);