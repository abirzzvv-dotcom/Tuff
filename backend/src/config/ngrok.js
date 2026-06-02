const { spawn } = require("child_process");

let publicUrl = null;
let isConnected = false;
let ngrokProcess = null;

const NGROK_API = "http://localhost:4040/api/tunnels";
const MAX_WAIT_MS = 15000;
const POLL_INTERVAL_MS = 500;

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

async function startNgrok(port) {
  if (!process.env.NGROK_AUTH_TOKEN) {
    console.warn("[Ngrok] NGROK_AUTH_TOKEN not set — skipping tunnel");
    return null;
  }

  // Kill any existing ngrok process
  await stopNgrok();

  console.log(`[Ngrok] Starting tunnel to port ${port}...`);

  return new Promise((resolve) => {
    const args = ["http", String(port), "--authtoken", process.env.NGROK_AUTH_TOKEN];
    if (process.env.NGROK_DOMAIN) {
      args.push("--domain", process.env.NGROK_DOMAIN);
    }

    ngrokProcess = spawn("ngrok", args, {
      stdio: ["ignore", "ignore", "ignore"],
      detached: false,
    });

    ngrokProcess.on("error", async (err) => {
      if (err.code === "ENOENT") {
        console.error(
          "[Ngrok] 'ngrok' binary not found.\n" +
          "[Ngrok] Install it in Termux:\n" +
          "[Ngrok]   pkg install wget\n" +
          "[Ngrok]   wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-arm64.tgz\n" +
          "[Ngrok]   tar -xzf ngrok-v3-stable-linux-arm64.tgz\n" +
          "[Ngrok]   mv ngrok $PREFIX/bin/\n" +
          "[Ngrok] Then restart the backend."
        );
      } else {
        console.error("[Ngrok] Process error:", err.message);
      }
      isConnected = false;
      resolve(null);
    });

    ngrokProcess.on("exit", (code) => {
      if (isConnected) {
        console.warn(`[Ngrok] Process exited (code ${code}) — tunnel lost`);
        isConnected = false;
        publicUrl = null;
      }
    });

    // Poll the ngrok local API until the tunnel URL appears
    waitForUrl().then((url) => {
      if (url) {
        publicUrl = url;
        isConnected = true;
        console.log(`[Ngrok] Tunnel active: ${url}`);
        resolve(url);
      } else {
        console.error("[Ngrok] Timed out waiting for tunnel URL. Is ngrok installed?");
        resolve(null);
      }
    });
  });
}

async function stopNgrok() {
  if (ngrokProcess) {
    try {
      ngrokProcess.kill();
    } catch {}
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
