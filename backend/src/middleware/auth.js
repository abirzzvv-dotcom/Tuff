const { pool } = require("../config/database");

async function requireAuth(req, res, next) {
  const token =
    req.headers["authorization"]?.replace("Bearer ", "") ||
    req.headers["x-session-token"];

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const result = await pool.query(
      `SELECT s.user_id, s.expires_at, u.id, u.username, u.email, u.role, u.is_verified, u.is_suspended
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = $1 AND s.expires_at > NOW()`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }

    const user = result.rows[0];

    if (user.is_suspended) {
      return res.status(403).json({ error: "Account suspended" });
    }

    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      is_verified: user.is_verified,
    };
    req.token = token;
    next();
  } catch (err) {
    console.error("[Auth Middleware] Error:", err.message);
    res.status(500).json({ error: "Auth check failed" });
  }
}

async function requireVerified(req, res, next) {
  if (!req.user.is_verified) {
    return res.status(403).json({ error: "Email verification required" });
  }
  next();
}

module.exports = { requireAuth, requireVerified };
