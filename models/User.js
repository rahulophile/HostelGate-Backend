// backend/models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },

    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      unique: true, // phone sab role ke liye unique
    },

    passwordHash: { type: String, required: true },

    // Student specific:
    gender: {
      type: String,
      enum: ["male", "female"],
      default: null,
    },
    roomNumber: { type: String, default: null },
    parentPhone: { type: String, default: null },
    session: { type: String, default: null },
    branch: { type: String, default: null },
    college: { type: String, default: null },

    // Student hostel type:
    hostelType: {
      type: String,
      enum: ["boys", "girls"],
      default: null,
    },

    // Role: student / guard / admin
    role: {
      type: String,
      enum: ["student", "guard", "admin"],
      default: "student",
    },

    // Guard ke liye: kaunse hostel pe duty hai
    assignedHostel: {
      type: String,
      enum: ["boys", "girls", null],
      default: null,
    },

    isApproved: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);
