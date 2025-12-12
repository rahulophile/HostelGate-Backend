// middleware/roleMiddleware.js
const roleMiddleware = (...allowedRoles) => {
    return (req, res, next) => {
      console.log("=== roleMiddleware called ===");
      console.log("Allowed roles:", allowedRoles);
      console.log("req.user:", req.user);
  
      if (!req.user) {
        console.log("No req.user found, sending 401");
        return res
          .status(401)
          .json({ message: "Unauthorized: user not attached to request" });
      }
  
      // Debug: agar role hi nahi hai user pe
      if (!req.user.role) {
        console.log(
          "User has NO role field. For now, allowing access (DEBUG MODE)."
        );
        return next();
      }
  
      if (!allowedRoles.includes(req.user.role)) {
        console.log(
          `User role '${req.user.role}' not in allowed roles [${allowedRoles.join(
            ", "
          )}]`
        );
        return res.status(403).json({
          message: `Forbidden: required roles [${allowedRoles.join(
            ", "
          )}], but your role is '${req.user.role}'`,
        });
      }
  
      console.log("Role matched, continuing...");
      next();
    };
  };
  
  module.exports = roleMiddleware;
  