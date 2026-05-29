const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { pool } = require("../config/database");
const { requireAuth, requireVerified } = require("../middleware/auth");
const { getProjectDir, ensureProjectDir } = require("../services/projectRunner");

const router = express.Router();
router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

async function verifyOwner(projectId, userId) {
  const result = await pool.query(
    "SELECT id FROM projects WHERE id = $1 AND user_id = $2",
    [projectId, userId]
  );
  if (result.rows.length === 0) throw new Error("Project not found");
}

function safePath(projectDir, filePath) {
  const resolved = path.resolve(projectDir, filePath);
  if (!resolved.startsWith(path.resolve(projectDir))) {
    throw new Error("Path traversal not allowed");
  }
  return resolved;
}

router.get("/:projectId/list", async (req, res) => {
  try {
    await verifyOwner(req.params.projectId, req.user.id);
    const dir = getProjectDir(req.params.projectId);

    if (!fs.existsSync(dir)) {
      return res.json({ files: [] });
    }

    const subPath = req.query.path || "";
    const targetDir = subPath ? safePath(dir, subPath) : dir;

    if (!fs.existsSync(targetDir)) {
      return res.status(404).json({ error: "Directory not found" });
    }

    const entries = fs.readdirSync(targetDir, { withFileTypes: true });
    const files = entries.map((entry) => ({
      name: entry.name,
      type: entry.isDirectory() ? "directory" : "file",
      path: subPath ? `${subPath}/${entry.name}` : entry.name,
      size: entry.isFile()
        ? fs.statSync(path.join(targetDir, entry.name)).size
        : null,
    }));

    res.json({ files });
  } catch (err) {
    res.status(err.message === "Project not found" ? 404 : 500).json({ error: err.message });
  }
});

router.get("/:projectId/read", async (req, res) => {
  const { path: filePath } = req.query;
  if (!filePath) return res.status(400).json({ error: "path query param required" });

  try {
    await verifyOwner(req.params.projectId, req.user.id);
    const dir = getProjectDir(req.params.projectId);
    const fullPath = safePath(dir, filePath);

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: "File not found" });
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      return res.status(400).json({ error: "Path is a directory" });
    }
    if (stat.size > 2 * 1024 * 1024) {
      return res.status(413).json({ error: "File too large to read (max 2MB)" });
    }

    const content = fs.readFileSync(fullPath, "utf8");
    res.json({ content, path: filePath });
  } catch (err) {
    res.status(err.message.includes("not found") ? 404 : 500).json({ error: err.message });
  }
});

router.post("/:projectId/write", requireVerified, async (req, res) => {
  const { path: filePath, content } = req.body;
  if (!filePath) return res.status(400).json({ error: "path is required" });
  if (content === undefined) return res.status(400).json({ error: "content is required" });

  try {
    await verifyOwner(req.params.projectId, req.user.id);
    const dir = getProjectDir(req.params.projectId);
    const fullPath = safePath(dir, filePath);

    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, "utf8");

    res.json({ message: "File saved", path: filePath });
  } catch (err) {
    res.status(err.message.includes("not found") ? 404 : 500).json({ error: err.message });
  }
});

router.delete("/:projectId/delete", requireVerified, async (req, res) => {
  const { path: filePath } = req.body;
  if (!filePath) return res.status(400).json({ error: "path is required" });

  try {
    await verifyOwner(req.params.projectId, req.user.id);
    const dir = getProjectDir(req.params.projectId);
    const fullPath = safePath(dir, filePath);

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: "File or directory not found" });
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(fullPath);
    }

    res.json({ message: "Deleted", path: filePath });
  } catch (err) {
    res.status(err.message.includes("not found") ? 404 : 500).json({ error: err.message });
  }
});

router.post("/:projectId/mkdir", requireVerified, async (req, res) => {
  const { path: dirPath } = req.body;
  if (!dirPath) return res.status(400).json({ error: "path is required" });

  try {
    await verifyOwner(req.params.projectId, req.user.id);
    const dir = getProjectDir(req.params.projectId);
    const fullPath = safePath(dir, dirPath);

    fs.mkdirSync(fullPath, { recursive: true });
    res.json({ message: "Directory created", path: dirPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:projectId/rename", requireVerified, async (req, res) => {
  const { oldPath, newPath } = req.body;
  if (!oldPath || !newPath) {
    return res.status(400).json({ error: "oldPath and newPath are required" });
  }

  try {
    await verifyOwner(req.params.projectId, req.user.id);
    const dir = getProjectDir(req.params.projectId);
    const fullOld = safePath(dir, oldPath);
    const fullNew = safePath(dir, newPath);

    if (!fs.existsSync(fullOld)) {
      return res.status(404).json({ error: "Source not found" });
    }

    fs.mkdirSync(path.dirname(fullNew), { recursive: true });
    fs.renameSync(fullOld, fullNew);
    res.json({ message: "Renamed", oldPath, newPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:projectId/upload", requireVerified, upload.array("files", 20), async (req, res) => {
  const uploadPath = req.body.path || "";

  try {
    await verifyOwner(req.params.projectId, req.user.id);
    const dir = getProjectDir(req.params.projectId);
    const targetDir = uploadPath ? safePath(dir, uploadPath) : dir;

    fs.mkdirSync(targetDir, { recursive: true });

    const saved = [];
    for (const file of req.files) {
      const filePath = path.join(targetDir, file.originalname);
      fs.writeFileSync(filePath, file.buffer);
      saved.push(file.originalname);
    }

    res.json({ message: "Files uploaded", files: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
