const { body, validationResult } = require("express-validator");
 
const validateReport = [
  body("email")
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage("Invalid email address"),
    
  body("heading")
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage("Heading must be 3-200 characters"),
    
  body("description")
    .trim()
    .isLength({ min: 10, max: 5000 })
    .withMessage("Description must be 10-5000 characters"),
    
  body("concern")
    .notEmpty()
    .isIn(["Civil", "Electrical", "Mechanical", "Safety Hazard", "Other"])
    .withMessage("Invalid concern type"),
    
  body("building")
    .trim()
    .notEmpty()
    .withMessage("Building is required"),
    
  body("college")
    .trim()
    .notEmpty()
    .isIn([
      "CICS", "COCS", "CTHM", "CBAA", "CLAC", 
      "COED", "CEAT", "CCJE", "Staff"
    ])
    .withMessage("Invalid college"),
];
 
const validateComment = [
  body("text")
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage("Comment must be 1-5000 characters"),
    
  body("by")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Name too long"),
];
 
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
      })),
    });
  }
  
  next();
};
 
module.exports = {
  validateReport,
  validateComment,
  handleValidationErrors,
};