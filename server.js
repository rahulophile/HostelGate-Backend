// server.js
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");
const adminRoutes = require("./routes/adminRoutes");
const guardRoutes = require("./routes/guardRoutes");



// Load .env
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Simple request logger
app.use((req, res, next) => {
  console.log(`➡️  ${req.method} ${req.url}`);
  next();
});

// ROOT route - open
app.get("/", (req, res) => {
  console.log("ROOT / hit");
  res.status(200).json({ message: "Hostel Gate API is running 🚀" });
});

// TEST route - open
app.get("/test", (req, res) => {
  console.log("/test hit");
  res.status(200).json({ ok: true, path: "/test" });
});

// ===== ROUTES IMPORT =====
const authRoutes = require("./routes/authRoutes");
const studentRoutes = require("./routes/studentRoutes");

// ===== USE ROUTES =====
app.use("/api/auth", authRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/guard", guardRoutes); 

// Catch-all 404 (ye LAST me hi rehna chahiye)
app.use((req, res) => {
  console.log("404 for:", req.method, req.url);
  res.status(404).json({ message: "Route not found" });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
