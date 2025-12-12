// backend/models/VisitLog.js
const mongoose = require("mongoose");

const visitLogSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    gate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Gate",
      required: true,
    },
    hostelType: {
      type: String,
      enum: ["boys", "girls"],
      required: true,
    },
    direction: {
      type: String,
      enum: ["IN", "OUT"],
      required: true,
    },
    reason: {
      type: String,
      default: null,
    },
    // keep but default approve (no manual guard approval now)
    status: {
      type: String,
      enum: ["approved", "rejected"],
      default: "approved",
    },
    handledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    handledAt: {
      type: Date,
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("VisitLog", visitLogSchema);
