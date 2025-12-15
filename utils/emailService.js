const nodemailer = require("nodemailer");

const EMAIL_USER = process.env.EMAIL_SERVICE_USER;
const EMAIL_PASS = process.env.EMAIL_SERVICE_PASS;

if (!EMAIL_USER || !EMAIL_PASS) {
  console.warn(
    "Email service credentials are missing. Set EMAIL_SERVICE_USER and EMAIL_SERVICE_PASS in .env"
  );
}

let cachedTransporter = null;

const getTransporter = () => {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  cachedTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });

  return cachedTransporter;
};

const sendOtpEmail = async ({ to, code, purpose }) => {
  if (!EMAIL_USER || !EMAIL_PASS) {
    throw new Error("Email service is not configured");
  }

  const transporter = getTransporter();

  const purposeText =
    purpose === "register"
      ? "complete your registration"
      : "reset your password";

  const mailOptions = {
    from: `HostelGate <${EMAIL_USER}>`,
    to,
    subject: "Your HostelGate verification code",
    html: `
      <div style="font-family: Arial, sans-serif; color: #0f172a;">
        <h2 style="color:#ea580c;">HostelGate Verification</h2>
        <p>Use the following one-time password to ${purposeText}:</p>
        <p style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color:#0f172a;">${code}</p>
        <p>This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = { sendOtpEmail };
