const mongoose = require("mongoose");

const COLLECTION = process.env.MONGODB_META_COLLECTION || "MetaCollection";



const StatusSchema = new mongoose.Schema(
  { id: '1', name: 'Pending', color: '#FFA500' },
  { id: '2', name: 'Pending Inspect', color: '#FFD700' },
  { id: '3', name: 'In Progress', color: '#4169E1' },
  { id: '4', name: 'Resolved', color: '#28A745' },
  { id: '5', name: 'Archived', color: '#6C757D' },
);


const PrioritySchema = new mongoose.Schema(
  { id: '1', name: 'Low', color: '#28A745' },
  { id: '2', name: 'Medium', color: '#FFC107' },
  { id: '3', name: 'High', color: '#ce4f01' },
  { id: '4', name: 'Urgent', color: '#a40010' },
);