// backend/routes/authRoutes.js

const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");
const {
  requestEmailOtp,
  verifyEmailOtp,
  validateEmailOtpToken,
} = require("../utils/emailOtpManager");

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

const findUserByIdentifier = async (rawInput = "") => {
  const trimmed = rawInput.trim();

  if (!trimmed) {
    return { user: null, normalized: null };
  }

  if (trimmed.includes("@")) {
    const normalizedEmail = trimmed.toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    return { user, normalized: { email: normalizedEmail } };
  }

  const cleanPhone = trimmed.replace(/\D/g, "");
  const user = await User.findOne({ phone: cleanPhone });
  return { user, normalized: { phone: cleanPhone } };
};

// ==============================
//  EMAIL OTP (SEND)
// ==============================
router.post("/email-otp/send", async (req, res) => {
  try {
    const { email, purpose } = req.body;

    if (!email || !purpose) {
      return res
        .status(400)
        .json({ message: "Email and purpose are required for OTP" });
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (!["register", "forgot", "login"].includes(purpose)) {
      return res.status(400).json({ message: "Invalid OTP purpose" });
    }

    if (purpose === "register") {
      const existingEmail = await User.findOne({ email: normalizedEmail });
      if (existingEmail) {
        return res.status(400).json({ message: "Email already registered" });
      }
    }

    if (purpose === "forgot") {
      const existingUser = await User.findOne({ email: normalizedEmail });
      if (!existingUser) {
        return res
          .status(404)
          .json({ message: "No account found with the provided email" });
      }
    }

    if (purpose === "login") {
      const existingUser = await User.findOne({ email: normalizedEmail });
      if (!existingUser) {
        return res
          .status(404)
          .json({ message: "No account found with the provided email" });
      }
    }

    const { expiresAt } = await requestEmailOtp({
      email: normalizedEmail,
      purpose,
    });

    return res.status(200).json({
      message: "OTP sent to email",
      expiresAt,
    });
  } catch (error) {
    console.error("Email OTP send error:", error.message);
    return res.status(500).json({ message: "Could not send OTP" });
  }
});

// ==============================
//  EMAIL OTP (VERIFY)
// ==============================
router.post("/email-otp/verify", async (req, res) => {
  try {
    const { email, purpose, code } = req.body;

    if (!email || !purpose || !code) {
      return res
        .status(400)
        .json({ message: "Email, purpose and code are required" });
    }

    if (!["register", "forgot", "login"].includes(purpose)) {
      return res.status(400).json({ message: "Invalid OTP purpose" });
    }

    const token = await verifyEmailOtp({
      email,
      purpose,
      code,
    });

    return res.status(200).json({
      message: "OTP verified",
      emailOtpToken: token,
    });
  } catch (error) {
    console.error("Email OTP verify error:", error.message);
    return res.status(400).json({ message: error.message });
  }
});

// ==============================
//  REGISTER STUDENT
// ==============================
router.post("/register-student", async (req, res) => {
  try {
    console.log("POST /api/auth/register-student hit");

    const {
      name,
      email,
      phone,
      password,
      gender,
      roomNumber,
      parentPhone,
      session,
      branch,
      hostelType,
      emailOtpToken,
      college,
    } = req.body;

    if (!name || !email || !phone || !password || !gender || !hostelType) {
      return res.status(400).json({
        message: "Name, email, phone, password, gender and hostelType are required",
      });
    }

    if (!emailOtpToken) {
      return res.status(400).json({
        message: "Email verification is required before registration",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedPhone = phone.trim().replace(/\D/g, "");

    try {
      validateEmailOtpToken(emailOtpToken, normalizedEmail, "register");
    } catch (tokenError) {
      return res.status(400).json({ message: tokenError.message });
    }

    const existingByEmail = await User.findOne({ email: normalizedEmail });
    if (existingByEmail) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const existingByPhone = await User.findOne({ phone: normalizedPhone });
    if (existingByPhone) {
      return res.status(400).json({ message: "Phone already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      name,
      email: normalizedEmail,
      phone,
      passwordHash: hashedPassword,
      gender,
      roomNumber,
      parentPhone,
      session,
      branch,
      hostelType,
      college,
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
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role,
        hostelType: newUser.hostelType,
        college: newUser.college,
      },
    });
  } catch (error) {
    console.error("Register student error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
});

// ==============================
//  RESET PASSWORD (Email OTP verified)
// ==============================
router.post("/reset-password", async (req, res) => {
  try {
    const { email, newPassword, emailOtpToken } = req.body;

    if (!email || !newPassword || !emailOtpToken) {
      return res.status(400).json({
        message: "Email, new password, and OTP verification token are required",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    try {
      validateEmailOtpToken(emailOtpToken, normalizedEmail, "forgot");
    } catch (tokenError) {
      return res.status(400).json({ message: tokenError.message });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res
        .status(404)
        .json({ message: "Account not found for the provided email" });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res
      .status(200)
      .json({ message: "Password reset successful. You can now login." });
  } catch (error) {
    console.error("Reset password error:", error.message);
    return res.status(500).json({ message: "Could not reset password" });
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
//  CURRENT SESSION
// ==============================
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(404).json({ message: "Session user not found" });
    }

    return res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email || null,
        phone: user.phone || null,
        role: user.role,
        hostelType: user.hostelType || null,
        assignedHostel: user.assignedHostel || null,
        roomNumber: user.roomNumber || null,
        parentPhone: user.parentPhone || null,
        branch: user.branch || null,
        session: user.session || null,
        gender: user.gender || null,
        college: user.college || null,
        isApproved: user.isApproved ?? null,
      },
    });
  } catch (error) {
    console.error("Auth session error:", error.message);
    return res.status(500).json({ message: "Could not verify session" });
  }
});

// ==============================
//  LOGIN STEP 1: REQUEST OTP (STUDENT + ADMIN + GUARD)
// ==============================
router.post("/login/request-otp", async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res
        .status(400)
        .json({ message: "Identifier and password are required" });
    }

    const { user, normalized } = await findUserByIdentifier(identifier);

    if (!user) {
      return res
        .status(400)
        .json({ message: "Account not found. Please check your details." });
    }

    const passMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passMatch) {
      return res.status(400).json({ message: "Incorrect password" });
    }

    if (!user.email) {
      return res.status(400).json({
        message:
          "Email not found for this account. Please contact support to update your email before enabling OTP login.",
      });
    }

    const { expiresAt } = await requestEmailOtp({
      email: user.email,
      purpose: "login",
    });

    const pendingLoginToken = jwt.sign(
      {
        userId: user._id.toString(),
        type: "loginPending",
      },
      process.env.JWT_SECRET,
      { expiresIn: "10m" }
    );

    const [localPart, domainPart] = user.email.split("@");
    let maskedEmail = user.email;

    if (localPart && domainPart) {
      maskedEmail = `${localPart[0]}***@${domainPart}`;
    }

    return res.status(200).json({
      message: "OTP sent to your registered email",
      pendingLoginToken,
      expiresAt,
      identifierType: normalized?.email ? "email" : "phone",
      loginEmail: user.email,
      maskedEmail,
    });
  } catch (error) {
    console.error("Login OTP request error:", error.message);
    return res.status(500).json({ message: "Could not send login OTP" });
  }
});

// ==============================
//  LOGIN STEP 2: COMPLETE AFTER OTP VERIFICATION
// ==============================
router.post("/login/complete", async (req, res) => {
  try {
    const { pendingLoginToken, emailOtpToken } = req.body;

    if (!pendingLoginToken || !emailOtpToken) {
      return res.status(400).json({
        message: "OTP verification and pending login tokens are required",
      });
    }

    let pendingPayload;
    try {
      pendingPayload = jwt.verify(pendingLoginToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(400).json({ message: "Session expired. Please login again." });
    }

    if (pendingPayload?.type !== "loginPending" || !pendingPayload?.userId) {
      return res.status(400).json({ message: "Invalid login session" });
    }

    const user = await User.findById(pendingPayload.userId);

    if (!user) {
      return res
        .status(404)
        .json({ message: "Account not found. Please login again." });
    }

    if (!user.email) {
      return res.status(400).json({
        message: "Email missing for this account. Cannot complete OTP login.",
      });
    }

    try {
      validateEmailOtpToken(emailOtpToken, user.email, "login");
    } catch (tokenError) {
      return res.status(400).json({ message: tokenError.message });
    }

    const token = generateToken(user._id);

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        hostelType: user.hostelType || null,
        assignedHostel: user.assignedHostel || null,
        roomNumber: user.roomNumber || null,
        parentPhone: user.parentPhone || null,
        branch: user.branch || null,
        session: user.session || null,
        gender: user.gender || null,
        college: user.college || null,
      },
    });
  } catch (error) {
    console.error("Login complete error:", error.message);
    return res.status(500).json({ message: "Could not complete login" });
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
