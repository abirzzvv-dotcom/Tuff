const { execSync, exec, spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const { pool } = require("../config/database");

const PROJECTS_BASE_DIR = process.env.PROJECTS_DIR || path.join(process.env.HOME || "/root", "projects");

function getProjectDir(projectId) {
  return path.join(PROJECTS_BASE_DIR, projectId);
}

function ensureProjectDir(projectId) {
  const dir = getProjectDir(projectId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function isPm2Available() {
  try {
    execSync("pm2 --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

async function addLog(projectId, content, logType = "info") {
  try {
    await pool.query(
      "INSERT INTO logs (project_id, content, log_type) VALUES ($1, $2, $3)",
      [projectId, content.slice(0, 4096), logType]
    );
  } catch (err) {
    console.error("[ProjectRunner] Log write error:", err.message);
  }
}

async function startProject(projectId) {
  const result = await pool.query("SELECT * FROM projects WHERE id = $1", [projectId]);
  if (result.rows.length === 0) throw new Error("Project not found");

  const project = result.rows[0];
  const dir = getProjectDir(projectId);

  if (!fs.existsSync(dir)) {
    throw new Error("Project directory not found");
  }

  const entryFile = project.entry_file || getDefaultEntry(project.type);
  const pm2Name = `project-${projectId.slice(0, 8)}`;

  if (!isPm2Available()) {
    throw new Error("PM2 is not installed. Run: npm install -g pm2");
  }

  try {
    execSync(`pm2 delete ${pm2Name}`, { stdio: "ignore" });
  } catch {}

  const command = buildStartCommand(project.type, entryFile, dir);

  execSync(
    `pm2 start ${command} --name ${pm2Name} --output /dev/null --error /dev/null`,
    { cwd: dir }
  );

  const infoRaw = execSync(`pm2 jlist`, { cwd: dir }).toString();
  const info = JSON.parse(infoRaw);
  const proc = info.find((p) => p.name === pm2Name);
  const pm2Id = proc ? String(proc.pm_id) : null;

  await pool.query(
    "UPDATE projects SET status = 'running', pm2_id = $1, updated_at = NOW() WHERE id = $2",
    [pm2Name, projectId]
  );

  await addLog(projectId, `Project started (pm2: ${pm2Name})`, "info");
  return { pm2Name };
}

async function stopProject(projectId) {
  const result = await pool.query("SELECT pm2_id FROM projects WHERE id = $1", [projectId]);
  if (result.rows.length === 0) throw new Error("Project not found");

  const pm2Name = result.rows[0].pm2_id || `project-${projectId.slice(0, 8)}`;

  try {
    execSync(`pm2 stop ${pm2Name}`, { stdio: "pipe" });
    execSync(`pm2 delete ${pm2Name}`, { stdio: "pipe" });
  } catch (err) {
    console.warn("[ProjectRunner] PM2 stop warning:", err.message);
  }

  await pool.query(
    "UPDATE projects SET status = 'stopped', pm2_id = NULL, updated_at = NOW() WHERE id = $1",
    [projectId]
  );
  await addLog(projectId, "Project stopped", "info");
}

async function restartProject(projectId) {
  await stopProject(projectId);
  return startProject(projectId);
}

function buildStartCommand(type, entryFile, dir) {
  const entry = path.join(dir, entryFile);
  switch (type) {
    case "python":
    case "discord-python":
      return `python ${entry} --interpreter python`;
    case "nodejs":
    case "discord-node":
    case "api":
    case "websocket":
    default:
      return entry;
  }
}

function getDefaultEntry(type) {
  switch (type) {
    case "python":
    case "discord-python":
      return "main.py";
    case "nodejs":
    case "discord-node":
    case "api":
    case "websocket":
    default:
      return "index.js";
  }
}

async function installNpmPackages(projectId, packages) {
  const dir = getProjectDir(projectId);
  ensureProjectDir(projectId);

  const pkgList = Array.isArray(packages) ? packages.join(" ") : packages;

  return new Promise((resolve, reject) => {
    exec(`npm install ${pkgList}`, { cwd: dir, timeout: 120000 }, async (err, stdout, stderr) => {
      const output = stdout + (stderr ? "\n" + stderr : "");
      await addLog(projectId, `npm install ${pkgList}\n${output}`, err ? "error" : "info");
      if (err) reject(new Error(stderr || err.message));
      else resolve(output);
    });
  });
}

async function installPipPackages(projectId, packages) {
  const dir = getProjectDir(projectId);
  ensureProjectDir(projectId);

  const pkgList = Array.isArray(packages) ? packages.join(" ") : packages;

  return new Promise((resolve, reject) => {
    exec(`pip install ${pkgList}`, { cwd: dir, timeout: 120000 }, async (err, stdout, stderr) => {
      const output = stdout + (stderr ? "\n" + stderr : "");
      await addLog(projectId, `pip install ${pkgList}\n${output}`, err ? "error" : "info");
      if (err) reject(new Error(stderr || err.message));
      else resolve(output);
    });
  });
}

async function getProjectLogs(projectId, limit = 100) {
  const result = await pool.query(
    "SELECT content, log_type, created_at FROM logs WHERE project_id = $1 ORDER BY created_at DESC LIMIT $2",
    [projectId, limit]
  );
  return result.rows;
}

async function getPm2Status(pm2Name) {
  try {
    const raw = execSync("pm2 jlist", { stdio: "pipe" }).toString();
    const list = JSON.parse(raw);
    const proc = list.find((p) => p.name === pm2Name);
    if (!proc) return null;
    return {
      name: proc.name,
      status: proc.pm2_env?.status || "unknown",
      cpu: proc.monit?.cpu || 0,
      memory: proc.monit?.memory || 0,
      restarts: proc.pm2_env?.restart_time || 0,
      uptime: proc.pm2_env?.pm_uptime || null,
    };
  } catch {
    return null;
  }
}

module.exports = {
  getProjectDir,
  ensureProjectDir,
  startProject,
  stopProject,
  restartProject,
  installNpmPackages,
  installPipPackages,
  getProjectLogs,
  getPm2Status,
};
