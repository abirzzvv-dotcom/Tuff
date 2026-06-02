const { spawn, execSync } = require("child_process");

let publicUrl = null;
let isConnected = false;
let ngrokProcess = null;

const NGROK_API = "http://localhost:4040/api/tunnels";
const MAX_WAIT_MS = 20000;
const POLL_INTERVAL_MS = 600;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForUrl(timeoutMs = MAX_WAIT_MS) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(NGROK_API);
      if (res.ok) {
        const data = await res.json();
        const tunnel = data.tunnels?.find((t) => t.proto === "https");
        if (tunnel?.public_url) return tunnel.public_url;
      }
    } catch {}
    await sleep(POLL_INTERVAL_MS);
  }
  return null;
}

function configureAuthToken(token) {
  try {
    execSync(`ngrok config add-authtoken ${token}`, { stdio: "pipe" });
    return true;
  } catch (err) {
    console.error("[Ngrok] Failed to configure auth token:", err.stderr?.toString() || err.message);
    return false;
  }
}

async function startNgrok(port) {
  if (!process.env.NGROK_AUTH_TOKEN) {
    console.warn("[Ngrok] NGROK_AUTH_TOKEN not set — skipping tunnel");
    return null;
  }

  // Kill any existing ngrok process
  await stopNgrok();

  // Configure auth token into ngrok's config file first
  console.log("[Ngrok] Configuring auth token...");
  const configured = configureAuthToken(process.env.NGROK_AUTH_TOKEN);
  if (!configured) {
    console.error("[Ngrok] Auth token configuration failed — skipping tunnel");
    return null;
  }

  console.log(`[Ngrok] Starting tunnel to port ${port}...`);

  const args = ["http", String(port)];
  if (process.env.NGROK_DOMAIN) {
    args.push("--domain", process.env.NGROK_DOMAIN);
  }

  return new Promise((resolve) => {
    ngrokProcess = spawn("ngrok", args, {
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    });

    ngrokProcess.stdout.on("data", (data) => {
      const line = data.toString().trim();
      if (line && process.env.NGROK_DEBUG === "true") {
        console.log("[Ngrok]", line);
      }
    });

    ngrokProcess.stderr.on("data", (data) => {
      const line = data.toString().trim();
      if (line) console.error("[Ngrok] ERR:", line);
    });

    ngrokProcess.on("error", (err) => {
      if (err.code === "ENOENT") {
        console.error(
          "[Ngrok] 'ngrok' binary not found. Install it:\n" +
          "  pkg install wget\n" +
          "  wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-arm64.tgz\n" +
          "  tar -xzf ngrok-v3-stable-linux-arm64.tgz && mv ngrok $PREFIX/bin/"
        );
      } else {
        console.error("[Ngrok] Spawn error:", err.message);
      }
      isConnected = false;
      resolve(null);
    });

    ngrokProcess.on("exit", (code) => {
      if (isConnected) {
        console.warn(`[Ngrok] Process exited (code ${code}) — tunnel lost`);
        isConnected = false;
        publicUrl = null;
      } else if (code !== 0 && code !== null) {
        console.error(`[Ngrok] Exited with code ${code} before tunnel was ready`);
      }
    });

    // Poll the local ngrok API until tunnel URL appears
    waitForUrl().then((url) => {
      if (url) {
        publicUrl = url;
        isConnected = true;
        console.log(`[Ngrok] Tunnel active: ${url}`);
      } else {
        console.error("[Ngrok] Timed out — tunnel did not start. Check NGROK_AUTH_TOKEN.");
        // Kill the hung process if it didn't produce a URL
        try { ngrokProcess?.kill(); } catch {}
      }
      resolve(url);
    });
  });
}

async function stopNgrok() {
  if (ngrokProcess) {
    try { ngrokProcess.kill(); } catch {}
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
