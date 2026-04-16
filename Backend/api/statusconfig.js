
const express = require("express");
const router  = express.Router();
const Meta    = require("../models/Status");


const StatusConfig = {
  "Pending": {
    color: "#FFA500", // Orange
  },
  "For Inspection": {
    color: "#17A2B8", // Teal
  },
  "In Progress": {
    color: "#007BFF", // Blue
  },
  "Resolved": {
    color: "#28A745", // Green
  }
}