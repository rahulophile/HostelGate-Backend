// backend/routes/authRoutes.js

const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

// ==============================
//  REGISTER STUDENT
// ==============================
router.post("/register-student", async (req, res) => {
  try {
    console.log("POST /api/auth/register-student hit");

    const {
      name,
      phone,
      password,
      gender,
      roomNumber,
      parentPhone,
      session,
      branch,
      hostelType,
    } = req.body;

    if (!name || !phone || !password || !gender || !hostelType) {
      return res.status(400).json({
        message: "Name, phone, password, gender and hostelType are required",
      });
    }

    const existing = await User.findOne({ phone });
    if (existing) {
      return res.status(400).json({ message: "Phone already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      name,
      phone,
      passwordHash: hashedPassword,
      gender,
      roomNumber,
      parentPhone,
      session,
      branch,
      hostelType,
      role: "student",
      isApproved: true,
    });

    const token = generateToken(newUser._id);

    return res.status(201).json({
      message: "Student registered successfully",
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        phone: newUser.phone,
        role: newUser.role,
        hostelType: newUser.hostelType,
      },
    });
  } catch (error) {
    console.error("Register student error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
});

// ==============================
//  ADMIN CREATE (SECRET PROTECTED)
// ==============================
router.post("/register-admin", async (req, res) => {
  try {
    console.log("POST /api/auth/register-admin hit");

    const { name, phone, password, secret } = req.body;

    if (!name || !phone || !password || !secret) {
      return res
        .status(400)
        .json({ message: "Name, phone, password and secret are required" });
    }

    // Secret check
    if (secret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ message: "Not allowed" });
    }

    const existing = await User.findOne({ phone });
    if (existing) {
      return res.status(400).json({ message: "Phone already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await User.create({
      name,
      phone,
      passwordHash: hashedPassword,
      role: "admin",
      isApproved: true,
    });

    const token = generateToken(admin._id);

    return res.status(201).json({
      message: "Admin created successfully",
      token,
      user: {
        id: admin._id,
        name: admin.name,
        phone: admin.phone,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error("Register admin error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
});

// ==============================
//  LOGIN (STUDENT + ADMIN + GUARD)
// ==============================
router.post("/login", async (req, res) => {
  try {
    console.log("POST /api/auth/login hit");
    console.log("Request body:", { phone: req.body.phone, hasPassword: !!req.body.password });

    const { phone, password } = req.body;

    if (!phone || !password) {
      console.log("Missing fields - phone:", !!phone, "password:", !!password);
      return res.status(400).json({ message: "Phone and password required" });
    }

    // Trim phone and remove any spaces
    const cleanPhone = phone.trim().replace(/\s+/g, "");
    console.log("Searching for user with phone:", cleanPhone);

    const user = await User.findOne({ phone: cleanPhone });
    if (!user) {
      console.log("User not found with phone:", cleanPhone);
      // Check if any user exists with similar phone
      const allUsers = await User.find().select("phone role").limit(5);
      console.log("Sample users in DB:", allUsers.map(u => ({ phone: u.phone, role: u.role })));
      return res.status(400).json({ message: "User not found. Please check your phone number." });
    }

    console.log("User found:", { id: user._id, name: user.name, role: user.role });

    const passMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passMatch) {
      console.log("Password mismatch for user:", user._id);
      return res.status(400).json({ message: "Incorrect password" });
    }

    const token = generateToken(user._id);
    console.log("Login successful for user:", user._id);

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        hostelType: user.hostelType || null,
        assignedHostel: user.assignedHostel || null,
        roomNumber: user.roomNumber || null,
        parentPhone: user.parentPhone || null,
        branch: user.branch || null,
        session: user.session || null,
        gender: user.gender || null,
      },
    });
  } catch (error) {
    console.error("Login error:", error.message);
    console.error("Error stack:", error.stack);
    return res.status(500).json({ message: "Server error" });
  }
});

// ==============================
//  PLACEHOLDER (Admin → Guard Create)
//  actual admin-only guard creation hum agle step me banayenge
// ==============================
// router.post("/admin/create-guard", authMiddleware, adminOnly, ...)

// ==============================
// EXPORT
// ==============================
module.exports = router;
