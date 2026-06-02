const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

let publicUrl = null;
let isConnected = false;
let ngrokProcess = null;

const NGROK_CONFIG_DIR = path.join(os.homedir(), ".config", "ngrok");
const NGROK_CONFIG_FILE = path.join(NGROK_CONFIG_DIR, "ngrok.yml");

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function writeConfig(token) {
  try {
    fs.mkdirSync(NGROK_CONFIG_DIR, { recursive: true });
    // version "3" with agent.authtoken is correct for ngrok v3
    const yaml = `version: "3"\nagent:\n  authtoken: ${token}\n`;
    fs.writeFileSync(NGROK_CONFIG_FILE, yaml, "utf8");
    return true;
  } catch (err) {
    console.error("[Ngrok] Failed to write config:", err.message);
    return false;
  }
}

function extractUrl(text) {
  // Match any ngrok-ish HTTPS URL
  const m = text.match(/https:\/\/[a-zA-Z0-9\-\.]+\.ngrok[a-zA-Z0-9\-\.]*\.(app|dev|io|free\.app)/);
  return m ? m[0] : null;
}

async function pollApi(timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch("http://localhost:4040/api/tunnels");
      if (res.ok) {
        const data = await res.json();
        const tunnel = (data.tunnels || []).find((t) => t.proto === "https");
        if (tunnel?.public_url) return tunnel.public_url;
      }
    } catch {}
    await sleep(600);
  }
  return null;
}

async function startNgrok(port) {
  if (!process.env.NGROK_AUTH_TOKEN) {
    console.warn("[Ngrok] NGROK_AUTH_TOKEN not set — skipping tunnel");
    return null;
  }

  await stopNgrok();

  if (!writeConfig(process.env.NGROK_AUTH_TOKEN)) return null;

  const domain = process.env.NGROK_DOMAIN;
  const args = [
    "http", String(port),
    "--log=stdout",          // force logs to stdout
    "--log-format=json",     // structured JSON — easier to parse
    "--log-level=info",
  ];
  if (domain) args.push(`--url=${domain}`);

  console.log(`[Ngrok] Spawning: ngrok ${args.join(" ")}`);

  return new Promise((resolve) => {
    let resolved = false;
    const done = (url) => {
      if (resolved) return;
      resolved = true;
      if (url) {
        publicUrl = url;
        isConnected = true;
        console.log(`[Ngrok] Tunnel active: ${url}`);
      } else {
        console.error("[Ngrok] Failed to establish tunnel.");
      }
      resolve(url);
    };

    ngrokProcess = spawn("ngrok", args, {
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });

    // ngrok v3 writes JSON log lines to stdout with --log=stdout --log-format=json
    // Each line looks like: {"level":"info","msg":"started tunnel","url":"https://..."}
    let buf = "";
    const handleLine = (line) => {
      line = line.trim();
      if (!line) return;

      // Try JSON parse first
      try {
        const obj = JSON.parse(line);
        // The "started tunnel" log line contains the URL
        if (obj.url) {
          done(obj.url);
          return;
        }
        if (obj.addr && obj.url) {
          done(obj.url);
          return;
        }
        // Log non-URL lines at debug level
        if (obj.msg && obj.msg !== "heartbeat") {
          console.log(`[Ngrok] ${obj.lvl || obj.level || "info"}: ${obj.msg}${obj.err ? " — " + obj.err : ""}`);
        }
      } catch {
        // Not JSON — try regex
        console.log("[Ngrok]", line);
        const url = extractUrl(line);
        if (url) done(url);
      }
    };

    ngrokProcess.stdout.on("data", (chunk) => {
      buf += chunk.toString();
      const lines = buf.split("\n");
      buf = lines.pop(); // keep incomplete last line
      lines.forEach(handleLine);
    });

    ngrokProcess.stderr.on("data", (chunk) => {
      const lines = chunk.toString().split("\n");
      lines.forEach((l) => {
        l = l.trim();
        if (!l) return;
        console.error("[Ngrok ERR]", l);
        const url = extractUrl(l);
        if (url) done(url);
      });
    });

    ngrokProcess.on("error", (err) => {
      console.error("[Ngrok] Spawn error:", err.message);
      if (err.code === "ENOENT") {
        console.error(
          "[Ngrok] Binary not found. In Termux:\n" +
          "  pkg install wget\n" +
          "  wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-arm64.tgz\n" +
          "  tar -xzf ngrok-v3-stable-linux-arm64.tgz && mv ngrok $PREFIX/bin/"
        );
      }
      done(null);
    });

    ngrokProcess.on("exit", (code) => {
      if (buf.trim()) handleLine(buf); // flush remaining buffer
      if (!resolved) {
        console.error(`[Ngrok] Exited (code ${code}) before tunnel was ready.`);
        done(null);
      } else if (isConnected && code !== null) {
        console.warn(`[Ngrok] Process exited (code ${code})`);
        isConnected = false;
        publicUrl = null;
      }
    });

    // Also poll the 4040 API in parallel as a fallback
    pollApi(30000).then((url) => {
      if (url && !resolved) done(url);
    });
  });
}

async function stopNgrok() {
  if (ngrokProcess) {
    try { ngrokProcess.kill("SIGTERM"); } catch {}
    ngrokProcess = null;
  }
  isConnected = false;
  publicUrl = null;
}

function getPublicUrl() { return publicUrl; }
function isNgrokConnected() { return isConnected; }

module.exports = { startNgrok, stopNgrok, getPublicUrl, isNgrokConnected };
