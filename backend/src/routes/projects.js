const express = require("express");
const path = require("path");
const fs = require("fs");
const { pool } = require("../config/database");
const { requireAuth, requireVerified } = require("../middleware/auth");
const {
  getProjectDir,
  ensureProjectDir,
  startProject,
  stopProject,
  restartProject,
  installNpmPackages,
  installPipPackages,
  getProjectLogs,
  getPm2Status,
} = require("../services/projectRunner");

const router = express.Router();

router.use(requireAuth);

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, type, status, port, entry_file, description, created_at, updated_at FROM projects WHERE user_id = $1 ORDER BY created_at DESC",
      [req.user.id]
    );
    res.json({ projects: result.rows });
  } catch (err) {
    console.error("[Projects] List error:", err.message);
    res.status(500).json({ error: "Failed to list projects" });
  }
});

router.post("/", requireVerified, async (req, res) => {
  const { name, type, description, entryFile, port } = req.body;

  if (!name || !type) {
    return res.status(400).json({ error: "name and type are required" });
  }

  const validTypes = ["nodejs", "python", "discord-node", "discord-python", "api", "websocket"];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${validTypes.join(", ")}` });
  }

  try {
    const result = await pool.query(
      `INSERT INTO projects (user_id, name, type, description, entry_file, port)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, type, status, port, entry_file, description, created_at`,
      [req.user.id, name, type, description || null, entryFile || null, port || null]
    );

    const project = result.rows[0];
    ensureProjectDir(project.id);

    const dir = getProjectDir(project.id);
    const defaultFiles = getDefaultProjectFiles(type, name);
    for (const [filename, content] of Object.entries(defaultFiles)) {
      const filePath = path.join(dir, filename);
      const fileDir = path.dirname(filePath);
      fs.mkdirSync(fileDir, { recursive: true });
      fs.writeFileSync(filePath, content, "utf8");
    }

    res.status(201).json({ project });
  } catch (err) {
    console.error("[Projects] Create error:", err.message);
    res.status(500).json({ error: "Failed to create project" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, type, status, port, pm2_id, entry_file, description, created_at, updated_at FROM projects WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Project not found" });

    const project = result.rows[0];
    const pm2Status = project.pm2_id ? await getPm2Status(project.pm2_id) : null;

    res.json({ project, pm2Status });
  } catch (err) {
    console.error("[Projects] Get error:", err.message);
    res.status(500).json({ error: "Failed to get project" });
  }
});

router.put("/:id", async (req, res) => {
  const { name, description, entryFile, port } = req.body;
  try {
    const result = await pool.query(
      `UPDATE projects SET
         name = COALESCE($1, name),
         description = COALESCE($2, description),
         entry_file = COALESCE($3, entry_file),
         port = COALESCE($4, port),
         updated_at = NOW()
       WHERE id = $5 AND user_id = $6
       RETURNING id, name, type, status, port, entry_file, description`,
      [name, description, entryFile, port, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Project not found" });
    res.json({ project: result.rows[0] });
  } catch (err) {
    console.error("[Projects] Update error:", err.message);
    res.status(500).json({ error: "Failed to update project" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, pm2_id FROM projects WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Project not found" });

    try {
      await stopProject(req.params.id);
    } catch {}

    const dir = getProjectDir(req.params.id);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }

    await pool.query("DELETE FROM projects WHERE id = $1", [req.params.id]);
    res.json({ message: "Project deleted" });
  } catch (err) {
    console.error("[Projects] Delete error:", err.message);
    res.status(500).json({ error: "Failed to delete project" });
  }
});

router.post("/:id/start", requireVerified, async (req, res) => {
  try {
    await verifyProjectOwner(req.params.id, req.user.id);
    const result = await startProject(req.params.id);
    res.json({ message: "Project started", ...result });
  } catch (err) {
    console.error("[Projects] Start error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/stop", async (req, res) => {
  try {
    await verifyProjectOwner(req.params.id, req.user.id);
    await stopProject(req.params.id);
    res.json({ message: "Project stopped" });
  } catch (err) {
    console.error("[Projects] Stop error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/restart", requireVerified, async (req, res) => {
  try {
    await verifyProjectOwner(req.params.id, req.user.id);
    const result = await restartProject(req.params.id);
    res.json({ message: "Project restarted", ...result });
  } catch (err) {
    console.error("[Projects] Restart error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/install-npm", requireVerified, async (req, res) => {
  const { packages } = req.body;
  if (!packages || packages.length === 0) {
    return res.status(400).json({ error: "packages array is required" });
  }
  try {
    await verifyProjectOwner(req.params.id, req.user.id);
    const output = await installNpmPackages(req.params.id, packages);
    res.json({ message: "Packages installed", output });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/install-pip", requireVerified, async (req, res) => {
  const { packages } = req.body;
  if (!packages || packages.length === 0) {
    return res.status(400).json({ error: "packages array is required" });
  }
  try {
    await verifyProjectOwner(req.params.id, req.user.id);
    const output = await installPipPackages(req.params.id, packages);
    res.json({ message: "Packages installed", output });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id/logs", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  try {
    await verifyProjectOwner(req.params.id, req.user.id);
    const logs = await getProjectLogs(req.params.id, limit);
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function verifyProjectOwner(projectId, userId) {
  const result = await pool.query(
    "SELECT id FROM projects WHERE id = $1 AND user_id = $2",
    [projectId, userId]
  );
  if (result.rows.length === 0) throw new Error("Project not found");
}

function getDefaultProjectFiles(type, name) {
  switch (type) {
    case "nodejs":
    case "api":
      return {
        "index.js": `const express = require('express');\nconst app = express();\nconst PORT = process.env.PORT || 3000;\n\napp.use(express.json());\n\napp.get('/', (req, res) => {\n  res.json({ message: 'Hello from ${name}!' });\n});\n\napp.listen(PORT, () => {\n  console.log(\`Server running on port \${PORT}\`);\n});\n`,
        "package.json": JSON.stringify({ name: name.toLowerCase().replace(/\s+/g, "-"), version: "1.0.0", main: "index.js", dependencies: { express: "^4.18.2" } }, null, 2),
      };
    case "python":
      return {
        "main.py": `print("Hello from ${name}!")\n\n# Your code here\n`,
        "requirements.txt": `# Add your requirements here\n`,
      };
    case "discord-node":
      return {
        "index.js": `const { Client, GatewayIntentBits } = require('discord.js');\n\nconst client = new Client({\n  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]\n});\n\nclient.once('ready', () => {\n  console.log(\`Logged in as \${client.user.tag}\`);\n});\n\nclient.on('messageCreate', (message) => {\n  if (message.content === '!ping') {\n    message.reply('Pong!');\n  }\n});\n\nclient.login(process.env.DISCORD_TOKEN);\n`,
        "package.json": JSON.stringify({ name: name.toLowerCase().replace(/\s+/g, "-"), version: "1.0.0", main: "index.js", dependencies: { "discord.js": "^14.14.1" } }, null, 2),
        ".env": "DISCORD_TOKEN=your_bot_token_here\n",
      };
    case "discord-python":
      return {
        "main.py": `import discord\nimport os\n\nintents = discord.Intents.default()\nintents.message_content = True\nclient = discord.Client(intents=intents)\n\n@client.event\nasync def on_ready():\n    print(f'Logged in as {client.user}')\n\n@client.event\nasync def on_message(message):\n    if message.author == client.user:\n        return\n    if message.content == '!ping':\n        await message.channel.send('Pong!')\n\nclient.run(os.getenv('DISCORD_TOKEN'))\n`,
        "requirements.txt": "discord.py>=2.3.0\n",
        ".env": "DISCORD_TOKEN=your_bot_token_here\n",
      };
    case "websocket":
      return {
        "index.js": `const WebSocket = require('ws');\n\nconst PORT = process.env.PORT || 8080;\nconst wss = new WebSocket.Server({ port: PORT });\n\nwss.on('connection', (ws) => {\n  console.log('Client connected');\n  ws.send(JSON.stringify({ type: 'connected', message: 'Welcome to ${name}!' }));\n\n  ws.on('message', (data) => {\n    console.log('Received:', data.toString());\n    ws.send(JSON.stringify({ type: 'echo', data: data.toString() }));\n  });\n\n  ws.on('close', () => console.log('Client disconnected'));\n});\n\nconsole.log(\`WebSocket server running on port \${PORT}\`);\n`,
        "package.json": JSON.stringify({ name: name.toLowerCase().replace(/\s+/g, "-"), version: "1.0.0", main: "index.js", dependencies: { ws: "^8.14.2" } }, null, 2),
      };
    default:
      return { "README.md": `# ${name}\n\nProject type: ${type}\n` };
  }
}

module.exports = router;
