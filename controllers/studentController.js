// controllers/studentController.js
const Gate = require("../models/Gate");
const VisitLog = require("../models/VisitLog");

const checkInOut = async (req, res) => {
  try {
    console.log("=== checkInOut called ===");
    console.log("Body:", req.body);
    console.log("req.user:", req.user);

    const { gateCode, direction } = req.body;
    const student = req.user;

    if (!gateCode || !direction) {
      return res
        .status(400)
        .json({ message: "gateCode and direction are required" });
    }

    const dir = direction.toUpperCase();
    if (!["OUT", "IN"].includes(dir)) {
      return res.status(400).json({ message: "direction must be OUT or IN" });
    }

    const gate = await Gate.findOne({ code: gateCode, isActive: true });
    console.log("Gate found:", gate);

    if (!gate) {
      return res.status(404).json({ message: "Gate not found or inactive" });
    }

    if (
      student.hostelType &&
      gate.hostelType &&
      student.hostelType !== gate.hostelType
    ) {
      return res.status(403).json({
        message: `You are from ${student.hostelType} hostel, but this gate is for ${gate.hostelType} hostel`,
      });
    }

    const log = await VisitLog.create({
      student: student._id,
      gate: gate._id,
      hostelType: student.hostelType || gate.hostelType,
      direction: dir,
      timestamp: new Date(),
    });

    console.log("VisitLog created:", log);

    res.status(201).json({
      message: `Check-${dir === "OUT" ? "out" : "in"} recorded successfully`,
      log,
    });
  } catch (error) {
    console.error("checkInOut error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

const getMyLogs = async (req, res) => {
  try {
    console.log("=== getMyLogs called ===");
    console.log("req.user:", req.user);

    const student = req.user;

    const logs = await VisitLog.find({ student: student._id })
      .populate("gate", "name code hostelType")
      .sort({ timestamp: -1 })
      .limit(50);

    res.json({ logs });
  } catch (error) {
    console.error("getMyLogs error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  checkInOut,
  getMyLogs,
};
