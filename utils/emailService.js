const nodemailer = require("nodemailer");

const EMAIL_USER = process.env.EMAIL_SERVICE_USER; // Brevo SMTP login is the email used to signup
const BREVO_SMTP_KEY = process.env.BREVO_SMTP_KEY;

if (!EMAIL_USER || !BREVO_SMTP_KEY) {
  console.warn(
    "Email service credentials are missing. Set EMAIL_SERVICE_USER and BREVO_SMTP_KEY in .env"
  );
}

let cachedTransporter = null;

const getTransporter = () => {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  // Brevo SMTP settings
  cachedTransporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false, // Requires secure: false for port 587 (STARTTLS)
    auth: {
      user: "a445ee001@smtp-brevo.com", // Brevo assigned SMTP username
      pass: BREVO_SMTP_KEY,
    },
    connectionTimeout: 10000,
    socketTimeout: 15000,
  });

  return cachedTransporter;
};

const sendOtpEmail = async ({ to, code, purpose }) => {
  if (!EMAIL_USER || !BREVO_SMTP_KEY) {
    throw new Error("Email service is not configured");
  }

  const transporter = getTransporter();

  const purposeText =
    purpose === "register"
      ? "complete your registration"
      : "reset your password";

  const mailOptions = {
    // Brevo allows you to send from any email address (usually the one registered)
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

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent via Brevo:", info.messageId);
  } catch (error) {
    console.error("Brevo email send error:", error);
    throw new Error(error.message || "Failed to send email via Brevo");
  }
};

module.exports = { sendOtpEmail };
