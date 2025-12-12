// backend/routes/adminRoutes.js

const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Gate = require("../models/Gate");
const VisitLog = require("../models/VisitLog");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Sirf admin ko access
const adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

// ==============================
//  CREATE GUARD + GATE/QR
//  POST /api/admin/guards
// ==============================
router.post("/guards", authMiddleware, adminOnly, async (req, res) => {
  try {
    console.log("POST /api/admin/guards hit");

    const {
      name,
      phone,
      password,
      hostelType, // "boys" | "girls"
      gateName,   // e.g. "Main Gate - Boys Hostel"
      gateCode,   // e.g. "BOYS-MAIN-QR1"
    } = req.body;

    if (!name || !phone || !password || !hostelType) {
      return res.status(400).json({
        message: "Name, phone, password and hostelType are required",
      });
    }

    if (!["boys", "girls"].includes(hostelType)) {
      return res.status(400).json({ message: "Invalid hostelType" });
    }

    const existing = await User.findOne({ phone });
    if (existing) {
      return res.status(400).json({ message: "Phone already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Guard user create
    const guard = await User.create({
      name,
      phone,
      passwordHash: hashedPassword,
      role: "guard",
      assignedHostel: hostelType,
      isApproved: true,
    });

    let gate = null;

    // Agar gate details diye gaye hain to gate bhi create / update karo
    if (gateCode && gateName) {
      // Check if gate with same code already exists → update
      gate = await Gate.findOne({ code: gateCode });

      if (gate) {
        gate.name = gateName;
        gate.hostelType = hostelType;
        gate.assignedGuard = guard._id;
        gate.isActive = true;
        await gate.save();
      } else {
        gate = await Gate.create({
          hostelType,
          name: gateName,
          code: gateCode,
          isActive: true,
          assignedGuard: guard._id,
        });
      }
    }

    return res.status(201).json({
      message: "Guard created successfully",
      guard: {
        id: guard._id,
        name: guard.name,
        phone: guard.phone,
        role: guard.role,
        assignedHostel: guard.assignedHostel,
      },
      gate,
    });
  } catch (error) {
    console.error("Create guard error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
});

// ==============================
//  GET ALL GUARDS
//  GET /api/admin/guards
// ==============================
router.get("/guards", authMiddleware, adminOnly, async (req, res) => {
  try {
    const guards = await User.find({ role: "guard" }).select("-passwordHash");
    return res.json({ guards });
  } catch (error) {
    console.error("Get guards error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
});

// ==============================
//  UPDATE GUARD (name/phone/password/hostel)
//  PUT /api/admin/guards/:id
// ==============================
router.put("/guards/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    const guardId = req.params.id;
    const { name, phone, password, hostelType } = req.body;

    const guard = await User.findOne({ _id: guardId, role: "guard" });
    if (!guard) {
      return res.status(404).json({ message: "Guard not found" });
    }

    if (name) guard.name = name;
    if (phone) guard.phone = phone;
    if (hostelType && ["boys", "girls"].includes(hostelType)) {
      guard.assignedHostel = hostelType;
    }
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      guard.passwordHash = hashedPassword;
    }

    await guard.save();

    return res.json({
      message: "Guard updated successfully",
      guard: {
        id: guard._id,
        name: guard.name,
        phone: guard.phone,
        role: guard.role,
        assignedHostel: guard.assignedHostel,
      },
    });
  } catch (error) {
    console.error("Update guard error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
});

// ==============================
//  DELETE GUARD
//  DELETE /api/admin/guards/:id
// ==============================
router.delete("/guards/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    const guardId = req.params.id;

    const guard = await User.findOne({ _id: guardId, role: "guard" });
    if (!guard) {
      return res.status(404).json({ message: "Guard not found" });
    }

    // Unassign guard from any gate
    await Gate.updateMany(
      { assignedGuard: guard._id },
      { $set: { assignedGuard: null } }
    );

    await guard.deleteOne();

    return res.json({ message: "Guard deleted successfully" });
  } catch (error) {
    console.error("Delete guard error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
});

// ==============================
//  LIST GATES
//  GET /api/admin/gates
// ==============================
router.get("/gates", authMiddleware, adminOnly, async (req, res) => {
  try {
    const gates = await Gate.find().populate("assignedGuard", "name phone");
    return res.json({ gates });
  } catch (error) {
    console.error("Get gates error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
});

// ==============================
//  CREATE GATE
//  POST /api/admin/gates
// ==============================
router.post("/gates", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { name, code, hostelType, latitude, longitude, assignedGuardId } = req.body;

    if (!name || !code || !hostelType) {
      return res.status(400).json({
        message: "Name, code and hostelType are required",
      });
    }

    if (!["boys", "girls"].includes(hostelType)) {
      return res.status(400).json({ message: "Invalid hostelType" });
    }

    // Check if code already exists
    const existing = await Gate.findOne({ code });
    if (existing) {
      return res.status(400).json({ message: "Gate code already exists" });
    }

    const gateData = {
      name,
      code,
      hostelType,
      isActive: true,
    };

    if (latitude !== undefined && latitude !== null && latitude !== "") {
      const parsedLat = parseFloat(String(latitude).trim());
      if (isNaN(parsedLat) || parsedLat < -90 || parsedLat > 90) {
        return res.status(400).json({ message: "Invalid latitude value. Must be between -90 and 90." });
      }
      gateData.latitude = parsedLat;
      console.log("=== CREATE GATE - Setting latitude ===");
      console.log("Input:", latitude, "Type:", typeof latitude);
      console.log("Parsed:", parsedLat, "Type:", typeof parsedLat);
    }
    if (longitude !== undefined && longitude !== null && longitude !== "") {
      const parsedLng = parseFloat(String(longitude).trim());
      if (isNaN(parsedLng) || parsedLng < -180 || parsedLng > 180) {
        return res.status(400).json({ message: "Invalid longitude value. Must be between -180 and 180." });
      }
      gateData.longitude = parsedLng;
      console.log("=== CREATE GATE - Setting longitude ===");
      console.log("Input:", longitude, "Type:", typeof longitude);
      console.log("Parsed:", parsedLng, "Type:", typeof parsedLng);
    }
    if (assignedGuardId) {
      const guard = await User.findOne({ _id: assignedGuardId, role: "guard" });
      if (!guard) {
        return res.status(400).json({ message: "Invalid guard id" });
      }
      gateData.assignedGuard = guard._id;
    }

    const gate = await Gate.create(gateData);
    
    // Verify saved coordinates
    const savedGate = await Gate.findById(gate._id);
    console.log("Gate created - Saved coordinates:", {
      id: savedGate._id,
      code: savedGate.code,
      latitude: savedGate.latitude,
      longitude: savedGate.longitude,
      latType: typeof savedGate.latitude,
      lngType: typeof savedGate.longitude
    });

    return res.status(201).json({
      message: "Gate created successfully",
      gate: savedGate,
    });
  } catch (error) {
    console.error("Create gate error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
});

// ==============================
//  UPDATE GATE (name/code/hostel/isActive/location)
//  PUT /api/admin/gates/:id
// ==============================
router.put("/gates/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    const gateId = req.params.id;
    const { name, code, hostelType, isActive, assignedGuardId, latitude, longitude } = req.body;

    const gate = await Gate.findById(gateId);
    if (!gate) {
      return res.status(404).json({ message: "Gate not found" });
    }

    if (name) gate.name = name;
    if (code) gate.code = code;
    if (hostelType && ["boys", "girls"].includes(hostelType)) {
      gate.hostelType = hostelType;
    }
    if (typeof isActive === "boolean") gate.isActive = isActive;
    if (latitude !== undefined && latitude !== null && latitude !== "") {
      const parsedLat = parseFloat(String(latitude).trim());
      if (isNaN(parsedLat) || parsedLat < -90 || parsedLat > 90) {
        return res.status(400).json({ message: "Invalid latitude value. Must be between -90 and 90." });
      }
      console.log("=== UPDATE GATE - Setting latitude ===");
      console.log("Input:", latitude, "Type:", typeof latitude);
      console.log("Old value:", gate.latitude, "Type:", typeof gate.latitude);
      console.log("New parsed:", parsedLat, "Type:", typeof parsedLat);
      gate.latitude = parsedLat;
    }
    if (longitude !== undefined && longitude !== null && longitude !== "") {
      const parsedLng = parseFloat(String(longitude).trim());
      if (isNaN(parsedLng) || parsedLng < -180 || parsedLng > 180) {
        return res.status(400).json({ message: "Invalid longitude value. Must be between -180 and 180." });
      }
      console.log("=== UPDATE GATE - Setting longitude ===");
      console.log("Input:", longitude, "Type:", typeof longitude);
      console.log("Old value:", gate.longitude, "Type:", typeof gate.longitude);
      console.log("New parsed:", parsedLng, "Type:", typeof parsedLng);
      gate.longitude = parsedLng;
    }

    if (assignedGuardId === null) {
      gate.assignedGuard = null;
    } else if (assignedGuardId) {
      const guard = await User.findOne({
        _id: assignedGuardId,
        role: "guard",
      });
      if (!guard) {
        return res.status(400).json({ message: "Invalid guard id" });
      }
      gate.assignedGuard = guard._id;
    }

    await gate.save();
    
    // Reload to verify saved values
    const updatedGate = await Gate.findById(gateId);
    console.log("Gate updated - Saved coordinates:", {
      id: updatedGate._id,
      code: updatedGate.code,
      latitude: updatedGate.latitude,
      longitude: updatedGate.longitude,
      latType: typeof updatedGate.latitude,
      lngType: typeof updatedGate.longitude
    });

    return res.json({ message: "Gate updated successfully", gate: updatedGate });
  } catch (error) {
    console.error("Update gate error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
});

// ==============================
//  GET ADMIN LOGS (with filters)
//  GET /api/admin/logs
// ==============================
router.get("/logs", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { gateId, startDate, endDate, direction } = req.query;

    const query = {};

    if (gateId) {
      query.gate = gateId;
    }

    if (direction && ["IN", "OUT"].includes(direction)) {
      query.direction = direction;
    }

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        query.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        query.timestamp.$lte = new Date(endDate);
      }
    }

    const logs = await VisitLog.find(query)
      .populate("student", "name roomNumber branch phone")
      .populate("gate", "name code hostelType")
      .sort({ timestamp: -1 })
      .limit(1000);

    return res.json({ logs });
  } catch (error) {
    console.error("Get admin logs error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
