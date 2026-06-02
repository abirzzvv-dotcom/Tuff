const { spawn, execSync } = require("child_process");
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
    // version "3" is correct for ngrok v3
    fs.writeFileSync(NGROK_CONFIG_FILE, `version: "3"\nagent:\n  authtoken: ${token}\n`, "utf8");
    console.log("[Ngrok] Config written:", NGROK_CONFIG_FILE);
    return true;
  } catch (err) {
    console.error("[Ngrok] Failed to write config:", err.message);
    return false;
  }
}

// Poll the ngrok local API for a tunnel URL
async function pollApi(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch("http://localhost:4040/api/tunnels");
      if (res.ok) {
        const data = await res.json();
        const tunnel = data.tunnels?.find((t) => t.proto === "https");
        if (tunnel?.public_url) return tunnel.public_url;
      }
    } catch {}
    await sleep(500);
  }
  return null;
}

// Also try to parse URL directly from ngrok stdout
function parseUrlFromLine(line) {
  const match = line.match(/https:\/\/[a-z0-9\-\.]+\.ngrok[a-z0-9\-\.]*\.(?:app|dev|io)/i);
  return match ? match[0] : null;
}

async function startNgrok(port) {
  if (!process.env.NGROK_AUTH_TOKEN) {
    console.warn("[Ngrok] NGROK_AUTH_TOKEN not set — skipping tunnel");
    return null;
  }

  await stopNgrok();

  if (!writeConfig(process.env.NGROK_AUTH_TOKEN)) {
    return null;
  }

  const domain = process.env.NGROK_DOMAIN;
  const args = ["http", String(port)];
  if (domain) {
    args.push("--url", domain);
    console.log(`[Ngrok] Using static domain: ${domain}`);
  }

  console.log(`[Ngrok] Spawning: ngrok ${args.join(" ")}`);

  return new Promise((resolve) => {
    let resolved = false;
    const done = (url) => {
      if (resolved) return;
      resolved = true;
      resolve(url);
    };

    ngrokProcess = spawn("ngrok", args, {
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    });

    // Parse URL from stdout lines (ngrok v3 prints it here)
    ngrokProcess.stdout.on("data", (data) => {
      const lines = data.toString().split("\n");
      for (const line of lines) {
        if (line.trim()) console.log("[Ngrok]", line.trim());
        const url = parseUrlFromLine(line);
        if (url && !isConnected) {
          publicUrl = url;
          isConnected = true;
          console.log(`[Ngrok] Tunnel active (stdout): ${url}`);
          done(url);
        }
      }
    });

    ngrokProcess.stderr.on("data", (data) => {
      const lines = data.toString().split("\n");
      for (const line of lines) {
        if (line.trim()) {
          console.error("[Ngrok] ERR:", line.trim());
          // Also try parsing URL from stderr (some versions write there)
          const url = parseUrlFromLine(line);
          if (url && !isConnected) {
            publicUrl = url;
            isConnected = true;
            console.log(`[Ngrok] Tunnel active (stderr): ${url}`);
            done(url);
          }
        }
      }
    });

    ngrokProcess.on("error", (err) => {
      if (err.code === "ENOENT") {
        console.error(
          "[Ngrok] Binary not found. Run in Termux:\n" +
          "  pkg install wget && wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-arm64.tgz\n" +
          "  tar -xzf ngrok-v3-stable-linux-arm64.tgz && mv ngrok $PREFIX/bin/"
        );
      } else {
        console.error("[Ngrok] Spawn error:", err.message);
      }
      done(null);
    });

    ngrokProcess.on("exit", (code) => {
      if (!isConnected) {
        console.error(`[Ngrok] Exited with code ${code} before tunnel was ready.`);
        done(null);
      } else {
        console.warn(`[Ngrok] Process exited (code ${code})`);
        isConnected = false;
        publicUrl = null;
      }
    });

    // Also poll the API as a fallback (ngrok may not print URL in all modes)
    pollApi(18000).then((url) => {
      if (url && !isConnected) {
        publicUrl = url;
        isConnected = true;
        console.log(`[Ngrok] Tunnel active (API): ${url}`);
        done(url);
      } else if (!isConnected) {
        console.error("[Ngrok] Timed out waiting for tunnel URL.");
        done(null);
      }
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

function getPublicUrl() {
  return publicUrl;
}

function isNgrokConnected() {
  return isConnected;
}

module.exports = { startNgrok, stopNgrok, getPublicUrl, isNgrokConnected };
