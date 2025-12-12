// backend/routes/studentRoutes.js

const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const Gate = require("../models/Gate");
const VisitLog = require("../models/VisitLog");
const User = require("../models/User");

// ✅ Haversine distance helper (meters)
const computeDistanceMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) *
      Math.cos(φ2) *
      Math.sin(Δλ / 2) *
      Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

// ==============================
//  CHECK IN / OUT with location
//  POST /api/student/check
//  body: { gateCode, direction, lat, lng, reason? }
// ==============================
// ==============================
//  CHECK IN / OUT with location
//  POST /api/student/check
//  body: { gateCode, direction, lat, lng, reason? }
// ==============================
router.post("/check", authMiddleware, async (req, res) => {
  try {
    console.log("POST /api/student/check");
    console.log("Body:", req.body);

    const { gateCode, direction, lat, lng, reason } = req.body;
    const user = req.user;

    if (!gateCode || !direction) {
      return res
        .status(400)
        .json({ message: "gateCode and direction are required" });
    }

    if (!["IN", "OUT"].includes(direction)) {
      return res.status(400).json({ message: "Invalid direction" });
    }

    if (lat === undefined || lng === undefined) {
      return res
        .status(400)
        .json({ message: "Location (lat, lng) is required" });
    }

    if (!user.hostelType) {
      return res
        .status(400)
        .json({ message: "Student does not have a hostelType" });
    }

    // ✅ Reason sirf OUT ke liye mandatory
    if (direction === "OUT" && (!reason || !reason.trim())) {
      return res
        .status(400)
        .json({ message: "Reason is required for going OUT" });
    }

    const gate = await Gate.findOne({ code: gateCode });

    if (!gate) {
      return res.status(404).json({ message: "Gate not found" });
    }

    console.log("Gate found:", {
      id: gate._id,
      code: gate.code,
      name: gate.name,
      latitude: gate.latitude,
      longitude: gate.longitude,
      latType: typeof gate.latitude,
      lngType: typeof gate.longitude,
      rawGate: JSON.stringify(gate.toObject ? gate.toObject() : gate)
    });

    if (
      gate.latitude === undefined ||
      gate.latitude === null ||
      gate.longitude === undefined ||
      gate.longitude === null
    ) {
      return res.status(500).json({
        message:
          "Gate location is not configured. Contact admin.",
      });
    }

    // ✅ Distance check
    const studentLat = Number(lat);
    const studentLng = Number(lng);
    const gateLat = Number(gate.latitude);
    const gateLng = Number(gate.longitude);

    console.log("=== DISTANCE CALCULATION ===");
    console.log("Student Location:", { lat: studentLat, lng: studentLng });
    console.log("Gate Location:", { 
      code: gate.code, 
      name: gate.name,
      lat: gateLat, 
      lng: gateLng,
      latType: typeof gate.latitude,
      lngType: typeof gate.longitude
    });

    const distance = computeDistanceMeters(
      studentLat,
      studentLng,
      gateLat,
      gateLng
    );

    console.log(`Distance from gate ${gate.code}: ${distance.toFixed(2)}m`);
    console.log("===========================");

    if (distance > 5) {
      return res.status(403).json({
        message:
          "You must be within 5 meters of the gate to check in/out.",
        distance: distance.toFixed(2),
      });
    }

    // ✅ IN/OUT sequence rule
    const lastLog = await VisitLog.findOne({
      student: user._id,
      status: "approved",
    })
      .sort({ timestamp: -1 })
      .lean();

    let currentState = "inside"; // default: hostel ke andar
    if (lastLog && lastLog.direction === "OUT") {
      currentState = "outside";
    }

    // Already OUT + again OUT ❌
    if (direction === "OUT" && currentState === "outside") {
      return res.status(400).json({
        message:
          "You are already checked OUT. Please check IN before going OUT again.",
      });
    }

    // Already IN + again IN ❌ (clean rule)
    if (direction === "IN" && currentState === "inside") {
      return res.status(400).json({
        message:
          "You are already checked IN. Please check OUT before checking IN again.",
      });
    }

    const log = await VisitLog.create({
      student: user._id,
      gate: gate._id,
      hostelType: user.hostelType,
      direction,
      reason: direction === "OUT" ? reason : null,
      status: "approved",
      timestamp: new Date(),
    });

    return res.status(201).json({
      message:
        direction === "OUT"
          ? "Check OUT successful"
          : "Check IN successful",
      distance: distance.toFixed(2),
      log,
    });
  } catch (error) {
    console.error("Student check error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
});


// ==============================
//  STUDENT LOGS
//  GET /api/student/my-logs
// ==============================
router.get("/my-logs", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    console.log("GET /api/student/my-logs - User ID:", user._id);

    const logs = await VisitLog.find({ student: user._id })
      .populate("gate", "name code hostelType")
      .sort({ timestamp: -1 });

    console.log("Found logs:", logs.length);
    if (logs.length > 0) {
      console.log("Sample log:", {
        id: logs[0]._id,
        direction: logs[0].direction,
        timestamp: logs[0].timestamp,
        gate: logs[0].gate?.name,
        reason: logs[0].reason,
      });
    }

    return res.json({ logs });
  } catch (error) {
    console.error("Student logs error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
});

// optional: last log
router.get("/last-log", authMiddleware, async (req, res) => {
  try {
    const user = req.user;

    const log = await VisitLog.findOne({ student: user._id })
      .populate("gate", "name code hostelType")
      .sort({ timestamp: -1 });

    return res.json({ log });
  } catch (error) {
    console.error("Student last-log error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
});

// ==============================
//  GET PROFILE
//  GET /api/student/me
// ==============================
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const fullUser = await User.findById(user._id).select("-passwordHash");
    
    return res.json({
      message: "Profile fetched successfully",
      user: fullUser,
    });
  } catch (error) {
    console.error("Get profile error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
});

// ==============================
//  UPDATE PROFILE
//  PUT /api/student/me
//  body: { name, phone, parentPhone, roomNumber, branch, session }
// ==============================
router.put("/me", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const { name, phone, parentPhone, roomNumber, branch, session, gender } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    if (parentPhone !== undefined) updateData.parentPhone = parentPhone;
    if (roomNumber !== undefined) updateData.roomNumber = roomNumber;
    if (branch !== undefined) updateData.branch = branch;
    if (session !== undefined) updateData.session = session;
    if (gender !== undefined) updateData.gender = gender;

    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      { $set: updateData },
      { new: true, select: "-passwordHash" }
    );

    return res.json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Update profile error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
