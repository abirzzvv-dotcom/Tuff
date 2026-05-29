const nodemailer = require("nodemailer");

function createTransport() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

async function sendVerificationEmail(to, username, code) {
  const transporter = createTransport();
  await transporter.sendMail({
    from: `"TermuxHost" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Verify your TermuxHost account",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2 style="color:#6366f1">Verify your email</h2>
        <p>Hi <strong>${username}</strong>,</p>
        <p>Your verification code is:</p>
        <div style="font-size:32px;font-weight:bold;letter-spacing:8px;padding:16px;background:#f1f5f9;border-radius:8px;text-align:center">
          ${code}
        </div>
        <p>This code expires in <strong>15 minutes</strong>.</p>
        <p>If you didn't create an account, ignore this email.</p>
      </div>
    `,
  });
}

async function sendPasswordResetEmail(to, username, code) {
  const transporter = createTransport();
  await transporter.sendMail({
    from: `"TermuxHost" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Reset your TermuxHost password",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2 style="color:#6366f1">Password Reset</h2>
        <p>Hi <strong>${username}</strong>,</p>
        <p>Your password reset code is:</p>
        <div style="font-size:32px;font-weight:bold;letter-spacing:8px;padding:16px;background:#f1f5f9;border-radius:8px;text-align:center">
          ${code}
        </div>
        <p>This code expires in <strong>15 minutes</strong>.</p>
        <p>If you didn't request a reset, ignore this email.</p>
      </div>
    `,
  });
}

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail, generateCode };
