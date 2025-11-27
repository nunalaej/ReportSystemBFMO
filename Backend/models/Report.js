// Backend/models/Report.js
const mongoose = require("mongoose");

const collectionName = process.env.MONGODB_COLLECTION || "ReportCollection";

const ReportSchema = new mongoose.Schema(
  {
    email: String,
    heading: String,
    description: String,
    concern: String,
    subConcern: { type: String, default: "" },
    otherConcern: { type: String, default: "" },
    building: String,
    otherBuilding: { type: String, default: "" },
    college: { type: String, default: "Unspecified" },
    floor: { type: String, default: "" },
    room: { type: String, default: "" },
    otherRoom: { type: String, default: "" },
    image: { type: String, default: "" },
    status: {
      type: String,
      default: "Pending",
      enum: ["Pending", "In Progress", "Resolved", "Archived"],
    },
  },
  {
    timestamps: true,
    collection: collectionName, // uses MONGODB_COLLECTION
  }
);

module.exports = mongoose.model("Report", ReportSchema);
