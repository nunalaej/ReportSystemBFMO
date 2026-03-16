// models/UserLists.js
const mongoose = require("mongoose");

const TaskSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    done: { type: Boolean, default: false },
  },
  { _id: false }
);

const ListSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    tasks: { type: [TaskSchema], default: [] },
    collapsed: { type: Boolean, default: false },
  },
  { _id: false }
);

const UserListsSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    lists: { type: [ListSchema], default: [] },
    updatedAt: { type: Date, default: Date.now },
  }
);

module.exports =
  mongoose.models.UserLists ||
  mongoose.model("UserLists", UserListsSchema);