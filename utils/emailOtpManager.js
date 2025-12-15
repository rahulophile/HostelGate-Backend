const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const EmailOtp = require("../models/EmailOtp");
const { sendOtpEmail } = require("./emailService");

const OTP_EXPIRY_MINUTES = 10;
const OTP_SECRET = process.env.EMAIL_OTP_SECRET;

if (!OTP_SECRET) {
  console.warn("EMAIL_OTP_SECRET missing in environment. OTP tokens cannot be generated.");
}

const generateOtpCode = () => crypto.randomInt(100000, 999999).toString();

const requestEmailOtp = async ({ email, purpose }) => {
  const code = generateOtpCode();
  const hash = await bcrypt.hash(code, 10);

  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await EmailOtp.create({
    email: email.toLowerCase().trim(),
    purpose,
    codeHash: hash,
    expiresAt,
  });

  await sendOtpEmail({ to: email, code, purpose });

  return { expiresAt };
};

const verifyEmailOtp = async ({ email, purpose, code }) => {
  const record = await EmailOtp.findOne({
    email: email.toLowerCase().trim(),
    purpose,
  })
    .sort({ createdAt: -1 })
    .exec();

  if (!record) {
    throw new Error("No OTP request found. Please request a new code.");
  }

  if (record.expiresAt < new Date()) {
    await EmailOtp.deleteOne({ _id: record._id });
    throw new Error("OTP expired. Please request a new code.");
  }

  const hasAttemptsLeft = record.attempts < 5;
  if (!hasAttemptsLeft) {
    await EmailOtp.deleteOne({ _id: record._id });
    throw new Error("Too many attempts. Please request a new code.");
  }

  const isMatch = await bcrypt.compare(code, record.codeHash);

  if (!isMatch) {
    record.attempts += 1;
    await record.save();
    throw new Error("Invalid OTP. Please check the code and try again.");
  }

  await EmailOtp.deleteOne({ _id: record._id });

  if (!OTP_SECRET) {
    throw new Error("OTP token secret missing on server");
  }

  const token = jwt.sign(
    {
      email: email.toLowerCase().trim(),
      purpose,
      verified: true,
    },
    OTP_SECRET,
    { expiresIn: "10m" }
  );

  return token;
};

const validateEmailOtpToken = (token, expectedEmail, expectedPurpose) => {
  if (!OTP_SECRET) {
    throw new Error("OTP token secret missing on server");
  }

  try {
    const payload = jwt.verify(token, OTP_SECRET);
    if (
      !payload?.verified ||
      payload.email !== expectedEmail.toLowerCase().trim() ||
      payload.purpose !== expectedPurpose
    ) {
      throw new Error("OTP token mismatch");
    }

    return true;
  } catch (err) {
    throw new Error(err.message || "OTP token invalid or expired");
  }
};

module.exports = {
  requestEmailOtp,
  verifyEmailOtp,
  validateEmailOtpToken,
};
