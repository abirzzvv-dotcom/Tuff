const express = require("express");
const { requireAuth, requireVerified } = require("../middleware/auth");
const { pool } = require("../config/database");
const aiService = require("../services/ai");

const router = express.Router();
router.use(requireAuth, requireVerified);

router.post("/chat", async (req, res) => {
  const { message, projectId } = req.body;
  if (!message || message.trim().length === 0) {
    return res.status(400).json({ error: "message is required" });
  }

  if (projectId) {
    const result = await pool.query(
      "SELECT id FROM projects WHERE id = $1 AND user_id = $2",
      [projectId, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Project not found" });
    }
  }

  try {
    const result = await aiService.chat(req.user.id, projectId || null, message.trim());
    res.json(result);
  } catch (err) {
    console.error("[AI] Chat error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get("/history", async (req, res) => {
  const { projectId, limit } = req.query;
  try {
    const history = await aiService.getHistory(req.user.id, projectId || null, parseInt(limit) || 50);
    res.json({ history });
  } catch (err) {
    res.status(500).json({ error: "Failed to get history" });
  }
});

router.delete("/history", async (req, res) => {
  const { projectId } = req.query;
  try {
    await aiService.clearHistory(req.user.id, projectId || null);
    res.json({ message: "History cleared" });
  } catch (err) {
    res.status(500).json({ error: "Failed to clear history" });
  }
});

module.exports = router;
