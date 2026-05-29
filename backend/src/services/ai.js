const fs = require("fs");
const path = require("path");
const { pool } = require("../config/database");
const { getProjectDir } = require("./projectRunner");

const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const AI_MODEL = "google/gemma-3n-e4b-it";

async function callNvidiaAI(messages) {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error("NVIDIA_API_KEY not configured");

  const response = await fetch(NVIDIA_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`NVIDIA API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

function buildSystemPrompt(projectDir) {
  return `You are an expert AI coding assistant integrated into TermuxHost, a hosting platform running on Android Termux.

You have direct access to project files and can perform file operations. When the user asks you to create, modify, or delete files, respond with a JSON action block using this exact format:

<ACTION>
{
  "type": "create_file" | "modify_file" | "delete_file" | "create_directory" | "explain",
  "path": "relative/path/to/file",
  "content": "file content here (for create/modify)",
  "explanation": "what you did and why"
}
</ACTION>

You can also chain multiple actions:
<ACTIONS>
[
  { "type": "create_file", "path": "index.js", "content": "...", "explanation": "..." },
  { "type": "create_file", "path": "package.json", "content": "...", "explanation": "..." }
]
</ACTIONS>

Project directory: ${projectDir}

Capabilities:
- Create, read, modify, and delete files
- Generate complete working code
- Debug errors and explain issues
- Generate project templates
- Fix syntax errors
- Import and configure libraries
- Edit APIs and configuration files
- Reason about code structure

Rules:
- Always write complete, working code — no placeholders or TODOs
- Use lightweight packages compatible with Termux/Android
- For Node.js: prefer pure-JS packages over native bindings
- Always explain what you did after performing actions
- When generating code, include proper error handling
- Be concise but thorough`;
}

async function processAiActions(actions, projectDir) {
  const results = [];

  for (const action of actions) {
    const filePath = path.join(projectDir, action.path || "");

    try {
      switch (action.type) {
        case "create_file":
        case "modify_file": {
          const dir = path.dirname(filePath);
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(filePath, action.content || "", "utf8");
          results.push({ action: action.type, path: action.path, success: true });
          break;
        }
        case "delete_file": {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          results.push({ action: action.type, path: action.path, success: true });
          break;
        }
        case "create_directory": {
          fs.mkdirSync(filePath, { recursive: true });
          results.push({ action: action.type, path: action.path, success: true });
          break;
        }
        default:
          results.push({ action: action.type, success: true, skipped: true });
      }
    } catch (err) {
      results.push({ action: action.type, path: action.path, success: false, error: err.message });
    }
  }

  return results;
}

function parseActionsFromResponse(text) {
  const actionsMatch = text.match(/<ACTIONS>([\s\S]*?)<\/ACTIONS>/);
  const actionMatch = text.match(/<ACTION>([\s\S]*?)<\/ACTION>/);

  if (actionsMatch) {
    try {
      return JSON.parse(actionsMatch[1].trim());
    } catch {
      return [];
    }
  }

  if (actionMatch) {
    try {
      const parsed = JSON.parse(actionMatch[1].trim());
      return [parsed];
    } catch {
      return [];
    }
  }

  return [];
}

function readProjectContext(projectDir) {
  if (!fs.existsSync(projectDir)) return "";

  const files = [];
  function walk(dir, base = "") {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const rel = base ? `${base}/${entry.name}` : entry.name;
        if (entry.name === "node_modules" || entry.name === ".git") continue;
        if (entry.isDirectory()) {
          walk(path.join(dir, entry.name), rel);
        } else {
          files.push(rel);
        }
      }
    } catch {}
  }

  walk(projectDir);
  return files.length > 0 ? `\nProject files:\n${files.map((f) => `  - ${f}`).join("\n")}` : "";
}

async function chat(userId, projectId, userMessage) {
  const historyResult = await pool.query(
    "SELECT message, response FROM ai_history WHERE user_id = $1 AND project_id IS NOT DISTINCT FROM $2 ORDER BY created_at DESC LIMIT 10",
    [userId, projectId || null]
  );

  const projectDir = projectId ? getProjectDir(projectId) : null;
  const systemPrompt = buildSystemPrompt(projectDir || "No project selected");

  const fileContext = projectDir ? readProjectContext(projectDir) : "";

  const messages = [
    { role: "system", content: systemPrompt + fileContext },
    ...historyResult.rows
      .reverse()
      .flatMap((row) => [
        { role: "user", content: row.message },
        { role: "assistant", content: row.response },
      ]),
    { role: "user", content: userMessage },
  ];

  const aiResponse = await callNvidiaAI(messages);

  const actions = parseActionsFromResponse(aiResponse);
  let actionResults = [];

  if (actions.length > 0 && projectDir) {
    actionResults = await processAiActions(actions, projectDir);
  }

  await pool.query(
    "INSERT INTO ai_history (user_id, project_id, message, response) VALUES ($1, $2, $3, $4)",
    [userId, projectId || null, userMessage, aiResponse]
  );

  return { response: aiResponse, actions, actionResults };
}

async function getHistory(userId, projectId, limit = 50) {
  const result = await pool.query(
    `SELECT id, message, response, created_at FROM ai_history
     WHERE user_id = $1 AND project_id IS NOT DISTINCT FROM $2
     ORDER BY created_at ASC LIMIT $3`,
    [userId, projectId || null, limit]
  );
  return result.rows;
}

async function clearHistory(userId, projectId) {
  await pool.query(
    "DELETE FROM ai_history WHERE user_id = $1 AND project_id IS NOT DISTINCT FROM $2",
    [userId, projectId || null]
  );
}

module.exports = { chat, getHistory, clearHistory };
