import mongoose from "mongoose";

const reportSchema = new mongoose.Schema({
  email: String,
  heading: String,
  description: String,
  concern: String,
  subConcern: String,
  building: String,
  college: String,
  floor: String,
  room: String,
  imageFile: String,  // This can be a URL or base64 encoded image data
  otherConcern: String,
  otherBuilding: String,
  otherRoom: String,
  status: { type: String, default: "Pending" },
}, { timestamps: true });

export const Report = mongoose.models.Report || mongoose.model("Report", reportSchema);
