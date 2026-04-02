    const jwt = require("jsonwebtoken");
 
const authenticateToken = (req, res, next) => {
  // Get token from Authorization header: "Bearer <token>"
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
 
  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Authentication required. Please sign in.",
    });
  }
 
  try {
    // Verify token (use same secret as your auth system)
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret");
    
    // Attach user info to request
    req.user = {
      id: decoded.sub || decoded.userId,
      email: decoded.email,
      role: decoded.role || "student",
    };
    
    next();
  } catch (err) {
    return res.status(403).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};
 
const requireRole = (requiredRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }
 
    const userRole = req.user.role || "student";
    
    if (Array.isArray(requiredRole)) {
      if (!requiredRole.includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: "Insufficient permissions",
        });
      }
    } else {
      if (userRole !== requiredRole) {
        return res.status(403).json({
          success: false,
          message: "Insufficient permissions",
        });
      }
    }
    
    next();
  };
};
 
module.exports = { authenticateToken, requireRole };
 
 