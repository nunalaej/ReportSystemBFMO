// Backend/scripts/fetchSchema.js
const mongoose = require("mongoose");
require("dotenv").config();

async function fetchDatabaseSchema() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/bfmo";
    
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("Connected successfully!");

    // Get all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    
    console.log("\n📊 DATABASE SCHEMA OVERVIEW");
    console.log("=" .repeat(50));
    
    for (const collection of collections) {
      console.log(`\n📁 Collection: ${collection.name}`);
      console.log("-".repeat(40));
      
      // Get one sample document
      const sample = await mongoose.connection.db
        .collection(collection.name)
        .findOne({});
      
      if (sample) {
        console.log("Sample document structure:");
        console.log(JSON.stringify(sample, null, 2).substring(0, 500));
        if (JSON.stringify(sample).length > 500) {
          console.log("... (truncated)");
        }
      } else {
        console.log("No documents found in this collection");
      }
      
      // Get count
      const count = await mongoose.connection.db
        .collection(collection.name)
        .countDocuments();
      console.log(`Total documents: ${count}`);
    }
    
    // Specifically check for hiddenStudentStatuses in Meta collection
    console.log("\n🔍 Checking Meta collection for hiddenStudentStatuses...");
    const meta = await mongoose.connection.db
      .collection("metacollection")
      .findOne({ key: "main" });
    
    if (meta) {
      console.log("Meta document found!");
      console.log("hiddenStudentStatuses:", meta.hiddenStudentStatuses || "Not set");
      console.log("statuses:", meta.statuses?.map(s => s.name) || []);
      console.log("positionPerms:", Object.keys(meta.positionPerms || {}));
    } else {
      console.log("Meta document not found!");
    }
    
    await mongoose.disconnect();
    console.log("\n✅ Schema fetch completed!");
    
  } catch (error) {
    console.error("Error fetching schema:", error);
  }
}

fetchDatabaseSchema();