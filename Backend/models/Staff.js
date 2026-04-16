const mongoose = require("mongoose");

if (mongoose.models["Staff"]) delete mongoose.models["Staff"];

const StaffSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true },
    email:       { type: String, default: "", trim: true },
    phone:       { type: String, default: "" },
    position:    { type: String, default: "Staff Engineer" },
    disciplines: { type: [String], default: [] },
    active:      { type: Boolean, default: true },
    clerkId:     { type: String, default: "", trim: true }, // ✅ links to Clerk user
    notes:       { type: String, default: "" },
  },
  { timestamps: true }
);



module.exports = mongoose.model("Staff", StaffSchema);