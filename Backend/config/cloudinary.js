const cloudinary = require("cloudinary").v2;

console.log("[Cloudinary config] cloud_name:", process.env.CLOUDINARY_CLOUD_NAME);
console.log("[Cloudinary config] api_key:", process.env.CLOUDINARY_API_KEY);
// do NOT log the full secret in real life
console.log(
  "[Cloudinary config] api_secret prefix:",
  process.env.CLOUDINARY_API_SECRET
    ? process.env.CLOUDINARY_API_SECRET.slice(0, 4) + "... (hidden)"
    : "NOT SET"
);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

module.exports = cloudinary;
