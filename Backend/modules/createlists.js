const UserLists = require("../models/Userlists");

async function getListsForUser(userId) {
  if (!userId) throw new Error("Missing userId");
  const doc = await UserLists.findOne({ userId }).lean();
  return doc?.lists || [];
}

async function saveListsForUser(userId, lists) {
  if (!userId) throw new Error("Missing userId");
  if (!Array.isArray(lists)) throw new Error("lists must be an array");

  const doc = await UserLists.findOneAndUpdate(
    { userId },
    { $set: { lists, updatedAt: new Date() } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return doc;
}

module.exports = { getListsForUser, saveListsForUser };