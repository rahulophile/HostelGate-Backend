// backend/routes/guardRoutes.js

const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

// ⚠️ yaha WAHI model import karo jo tum /api/student/check me use kar rahe ho
// Example agar mera pehle wala code follow kiya tha:
// const VisitLog = require("../models/VisitLog");

// agar tumhare project me naam doosra hai, to jaisa hai waisa rakho:
const VisitLog = require("../models/VisitLog"); // <-- adjust if needed
const Gate = require("../models/Gate");

// sirf guard ko entry
const guardOnly = (req, res, next) => {
  if (!req.user || req.user.role !== "guard") {
    return res.status(403).json({ message: "Guard access required" });
  }
  next();
};

/**
 * GET /api/guard/logs
 * Guard ka assigned hostel ke recent logs
 */
router.get("/logs", authMiddleware, guardOnly, async (req, res) => {
  try {
    const hostelType = req.user.assignedHostel;

    if (!hostelType) {
      return res
        .status(400)
        .json({ message: "Guard is not assigned to any hostel" });
    }

    // last 50 logs for this hostel
    const logs = await VisitLog.find({ hostelType })
      .populate("student", "name roomNumber branch phone")
      .populate("gate", "name code")
      .sort({ timestamp: -1 })
      .limit(50);

    return res.json({ logs });
  } catch (error) {
    console.error("Guard logs error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
