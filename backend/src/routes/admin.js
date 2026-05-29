const express = require("express");
const { pool } = require("../config/database");
const { requireAuth } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/admin");
const { stopProject } = require("../services/projectRunner");

const router = express.Router();
router.use(requireAuth, requireAdmin);

router.get("/users", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    const countResult = await pool.query("SELECT COUNT(*) FROM users");
    const result = await pool.query(
      `SELECT id, username, email, role, is_verified, is_suspended, created_at
       FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json({
      users: result.rows,
      total: parseInt(countResult.rows[0].count),
      page,
      limit,
    });
  } catch (err) {
    console.error("[Admin] Users list error:", err.message);
    res.status(500).json({ error: "Failed to list users" });
  }
});

router.post("/users/:id/suspend", async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE users SET is_suspended = true, updated_at = NOW() WHERE id = $1 RETURNING id, username, email, is_suspended",
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "User not found" });
    await pool.query("DELETE FROM sessions WHERE user_id = $1", [req.params.id]);
    res.json({ message: "User suspended", user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Failed to suspend user" });
  }
});

router.post("/users/:id/unsuspend", async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE users SET is_suspended = false, updated_at = NOW() WHERE id = $1 RETURNING id, username, email, is_suspended",
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "User not found" });
    res.json({ message: "User unsuspended", user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Failed to unsuspend user" });
  }
});

router.post("/users/:id/promote", async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE users SET role = 'admin', updated_at = NOW() WHERE id = $1 RETURNING id, username, role",
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "User not found" });
    res.json({ message: "User promoted to admin", user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Failed to promote user" });
  }
});

router.post("/users/:id/demote", async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE users SET role = 'user', updated_at = NOW() WHERE id = $1 RETURNING id, username, role",
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "User not found" });
    res.json({ message: "User demoted", user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Failed to demote user" });
  }
});

router.delete("/users/:id", async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: "Cannot delete yourself" });
  }
  try {
    const result = await pool.query("DELETE FROM users WHERE id = $1 RETURNING id, username", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "User not found" });
    res.json({ message: "User deleted", user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete user" });
  }
});

router.get("/projects", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    const countResult = await pool.query("SELECT COUNT(*) FROM projects");
    const result = await pool.query(
      `SELECT p.id, p.name, p.type, p.status, p.created_at, u.username, u.email
       FROM projects p JOIN users u ON u.id = p.user_id
       ORDER BY p.created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json({
      projects: result.rows,
      total: parseInt(countResult.rows[0].count),
      page,
      limit,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to list projects" });
  }
});

router.post("/projects/:id/stop", async (req, res) => {
  try {
    await stopProject(req.params.id);
    res.json({ message: "Project stopped" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/projects/:id", async (req, res) => {
  try {
    const fs = require("fs");
    const { getProjectDir } = require("../services/projectRunner");
    try { await stopProject(req.params.id); } catch {}
    const dir = getProjectDir(req.params.id);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    await pool.query("DELETE FROM projects WHERE id = $1", [req.params.id]);
    res.json({ message: "Project deleted by admin" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const [users, projects, runningProjects, logs] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM users"),
      pool.query("SELECT COUNT(*) FROM projects"),
      pool.query("SELECT COUNT(*) FROM projects WHERE status = 'running'"),
      pool.query("SELECT COUNT(*) FROM logs"),
    ]);
    res.json({
      totalUsers: parseInt(users.rows[0].count),
      totalProjects: parseInt(projects.rows[0].count),
      runningProjects: parseInt(runningProjects.rows[0].count),
      totalLogs: parseInt(logs.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get stats" });
  }
});

module.exports = router;
