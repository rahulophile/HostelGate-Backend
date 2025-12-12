// backend/models/Gate.js
const mongoose = require("mongoose");

const gateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
    },
    hostelType: {
      type: String,
      enum: ["boys", "girls"],
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // ✅ NEW: location of gate
    latitude: {
      type: Number, // not required so old docs won't break
    },
    longitude: {
      type: Number,
    },
    // optional: which guard is assigned
    assignedGuard: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Gate", gateSchema);
