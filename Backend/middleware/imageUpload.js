const multer = require("multer");
const fileType = require("file-type");
const sharp = require("sharp");
 
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
 
// Store in memory, we'll process before saving
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_SIZE,
  },
  fileFilter: (req, file, cb) => {
    // This is a first-pass filter; magic bytes check comes later
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return cb(new Error("Invalid file type"));
    }
    cb(null, true);
  },
});
 
const validateAndProcessImage = async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "Image is required",
    });
  }
 
  try {
    // 1. Verify file type by magic bytes, not just MIME
    const type = await fileType.fromBuffer(req.file.buffer);
    
    if (!type || !ALLOWED_TYPES.includes(type.mime)) {
      return res.status(400).json({
        success: false,
        message: "Invalid image format. Only JPG, PNG, WEBP, GIF allowed.",
      });
    }
 
    // 2. Check file size
    if (req.file.size > MAX_SIZE) {
      return res.status(400).json({
        success: false,
        message: "Image exceeds 10MB limit",
      });
    }
 
    // 3. Re-encode image to remove any embedded malware
    // This also standardizes the format
    const reencoded = await sharp(req.file.buffer)
      .resize(2000, 2000, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .toBuffer();
 
    // Replace buffer with cleaned version
    req.file.buffer = reencoded;
    req.file.size = reencoded.length;
 
    next();
  } catch (err) {
    console.error("Image validation error:", err);
    return res.status(400).json({
      success: false,
      message: "Could not process image. Please try a different file.",
    });
  }
};
 
module.exports = {
  upload,
  validateAndProcessImage,
};