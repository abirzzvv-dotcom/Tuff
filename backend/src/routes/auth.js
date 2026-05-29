const express = require("express");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { pool } = require("../config/database");
const { requireAuth } = require("../middleware/auth");
const { sendVerificationEmail, sendPasswordResetEmail, generateCode } = require("../services/email");

const router = express.Router();

router.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: "username, email and password are required" });
  }
  if (username.length < 3 || username.length > 50) {
    return res.status(400).json({ error: "Username must be 3–50 characters" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  try {
    const existing = await pool.query(
      "SELECT id FROM users WHERE email = $1 OR username = $2",
      [email.toLowerCase(), username.toLowerCase()]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Username or email already in use" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userResult = await pool.query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3) RETURNING id, username, email, role, is_verified, created_at`,
      [username.toLowerCase(), email.toLowerCase(), passwordHash]
    );
    const user = userResult.rows[0];

    const code = generateCode();
    await pool.query(
      `INSERT INTO verification_codes (user_id, code, type, expires_at)
       VALUES ($1, $2, 'email_verify', NOW() + INTERVAL '15 minutes')`,
      [user.id, code]
    );

    try {
      await sendVerificationEmail(user.email, user.username, code);
    } catch (emailErr) {
      console.error("[Auth] Email send failed:", emailErr.message);
    }

    res.status(201).json({
      message: "Account created. Check your email for the verification code.",
      user: { id: user.id, username: user.username, email: user.email },
    });
  } catch (err) {
    console.error("[Auth] Register error:", err.message);
    res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  try {
    const result = await pool.query(
      "SELECT id, username, email, password_hash, role, is_verified, is_suspended FROM users WHERE email = $1",
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];

    if (user.is_suspended) {
      return res.status(403).json({ error: "Account suspended" });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await pool.query(
      "INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)",
      [user.id, token, expiresAt]
    );

    res.json({
      token,
      expiresAt,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        is_verified: user.is_verified,
      },
    });
  } catch (err) {
    console.error("[Auth] Login error:", err.message);
    res.status(500).json({ error: "Login failed" });
  }
});

router.post("/logout", requireAuth, async (req, res) => {
  try {
    await pool.query("DELETE FROM sessions WHERE token = $1", [req.token]);
    res.json({ message: "Logged out" });
  } catch (err) {
    res.status(500).json({ error: "Logout failed" });
  }
});

router.post("/verify-email", async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ error: "email and code are required" });
  }

  try {
    const userResult = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email.toLowerCase()]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    const userId = userResult.rows[0].id;

    const codeResult = await pool.query(
      `SELECT id FROM verification_codes
       WHERE user_id = $1 AND code = $2 AND type = 'email_verify'
       AND expires_at > NOW() AND used = false`,
      [userId, code]
    );

    if (codeResult.rows.length === 0) {
      return res.status(400).json({ error: "Invalid or expired verification code" });
    }

    await pool.query(
      "UPDATE verification_codes SET used = true WHERE id = $1",
      [codeResult.rows[0].id]
    );
    await pool.query(
      "UPDATE users SET is_verified = true, updated_at = NOW() WHERE id = $1",
      [userId]
    );

    res.json({ message: "Email verified successfully" });
  } catch (err) {
    console.error("[Auth] Verify error:", err.message);
    res.status(500).json({ error: "Verification failed" });
  }
});

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "email is required" });

  try {
    const result = await pool.query(
      "SELECT id, username FROM users WHERE email = $1",
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.json({ message: "If this email exists, a reset code was sent." });
    }

    const user = result.rows[0];
    const code = generateCode();

    await pool.query(
      `INSERT INTO verification_codes (user_id, code, type, expires_at)
       VALUES ($1, $2, 'password_reset', NOW() + INTERVAL '15 minutes')`,
      [user.id, code]
    );

    try {
      await sendPasswordResetEmail(email.toLowerCase(), user.username, code);
    } catch (emailErr) {
      console.error("[Auth] Reset email failed:", emailErr.message);
    }

    res.json({ message: "If this email exists, a reset code was sent." });
  } catch (err) {
    console.error("[Auth] Forgot password error:", err.message);
    res.status(500).json({ error: "Failed to process request" });
  }
});

router.post("/reset-password", async (req, res) => {
  const { email, code, newPassword } = req.body;

  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: "email, code and newPassword are required" });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  try {
    const userResult = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email.toLowerCase()]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    const userId = userResult.rows[0].id;

    const codeResult = await pool.query(
      `SELECT id FROM verification_codes
       WHERE user_id = $1 AND code = $2 AND type = 'password_reset'
       AND expires_at > NOW() AND used = false`,
      [userId, code]
    );

    if (codeResult.rows.length === 0) {
      return res.status(400).json({ error: "Invalid or expired reset code" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await pool.query("UPDATE verification_codes SET used = true WHERE id = $1", [codeResult.rows[0].id]);
    await pool.query(
      "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
      [passwordHash, userId]
    );
    await pool.query("DELETE FROM sessions WHERE user_id = $1", [userId]);

    res.json({ message: "Password reset successful. Please log in again." });
  } catch (err) {
    console.error("[Auth] Reset password error:", err.message);
    res.status(500).json({ error: "Password reset failed" });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  res.json({ user: req.user });
});

router.post("/resend-verification", requireAuth, async (req, res) => {
  if (req.user.is_verified) {
    return res.status(400).json({ error: "Email already verified" });
  }

  try {
    const code = generateCode();
    await pool.query(
      `INSERT INTO verification_codes (user_id, code, type, expires_at)
       VALUES ($1, $2, 'email_verify', NOW() + INTERVAL '15 minutes')`,
      [req.user.id, code]
    );
    await sendVerificationEmail(req.user.email, req.user.username, code);
    res.json({ message: "Verification code sent" });
  } catch (err) {
    console.error("[Auth] Resend verification error:", err.message);
    res.status(500).json({ error: "Failed to send verification email" });
  }
});

module.exports = router;
