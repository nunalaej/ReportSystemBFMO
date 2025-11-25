const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();  // To load environment variables from .env

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware to parse JSON bodies
app.use(express.json());

// Connect to MongoDB without deprecated options
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log("MongoDB connection error:", err));

// Example route
app.get("/", (req, res) => {
  res.send("Backend is running!");
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
