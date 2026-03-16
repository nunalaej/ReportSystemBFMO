// Backend/models/UserLists.js
const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema({
  id:   { type: String },
  text: { type: String },
  done: { type: Boolean, default: false },  // ← must be Boolean, not mixed
}, { _id: false });

const listSchema = new mongoose.Schema({
  id:        { type: String },
  title:     { type: String },
  tasks:     { type: [taskSchema], default: [] },
  collapsed: { type: Boolean, default: false },  // ← must be Boolean
}, { _id: false });

const userListsSchema = new mongoose.Schema({
  userId:    { type: String, required: true, unique: true },
  lists:     { type: [listSchema], default: [] },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("UserLists", userListsSchema);