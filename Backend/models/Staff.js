const mongoose = require("mongoose");

const StaffSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true },
    email:       { type: String, default: "", trim: true },
    phone:       { type: String, default: "" },
    position:    { type: String, default: "Staff Engineer" },
    disciplines: { type: [String], default: [] },
    active:      { type: Boolean, default: true },
    clerkId:     { type: String, default: "" },
    notes:       { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Staff || mongoose.model("Staff", StaffSchema);