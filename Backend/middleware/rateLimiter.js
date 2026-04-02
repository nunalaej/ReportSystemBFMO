const rateLimit = require("express-rate-limit");
 
// Create report - strict limit
const createReportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 reports per 15 minutes
  message: "Too many reports created. Please try again in 15 minutes.",
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.user?.role === "admin", // Admins not rate limited
  keyGenerator: (req) => req.user?.id || req.ip, // Use user ID if authenticated
});
 
// View reports - moderate limit
const getReportsLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
});
 
// Add comment - strict limit
const addCommentLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 20, // 20 comments per minute
  message: "Too many comments. Please slow down.",
  keyGenerator: (req) => req.user?.id || req.ip,
});
 
// Update status - moderate limit (admin action)
const updateStatusLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 50, // 50 updates per minute
  keyGenerator: (req) => req.user?.id || req.ip,
});
 
module.exports = {
  createReportLimiter,
  getReportsLimiter,
  addCommentLimiter,
  updateStatusLimiter,
};
 