// Backend/scripts/migrateHiddenStatuses.js
const mongoose = require("mongoose");
require("dotenv").config();

async function migrateHiddenStatuses() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/bfmo";
    
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    
    const Meta = require("../models/Meta");
    
    // Update existing Meta document
    const result = await Meta.findOneAndUpdate(
      { key: "main" },
      {
        $set: {
          hiddenStudentStatuses: ["Unfinished", "Closed"]
        }
      },
      { upsert: true, new: true }
    );
    
    console.log("✅ Migration completed!");
    console.log("hiddenStudentStatuses set to:", result.hiddenStudentStatuses);
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error("Migration error:", error);
  }
}

migrateHiddenStatuses();