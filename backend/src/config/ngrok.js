const ngrok = require("ngrok");

let publicUrl = null;
let isConnected = false;
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startNgrok(port, attempt = 1) {
  if (!process.env.NGROK_AUTH_TOKEN) {
    console.warn("[Ngrok] NGROK_AUTH_TOKEN not set — skipping tunnel");
    return null;
  }

  try {
    console.log(`[Ngrok] Starting tunnel to port ${port} (attempt ${attempt})...`);

    await ngrok.authtoken(process.env.NGROK_AUTH_TOKEN);

    const url = await ngrok.connect({
      addr: port,
      onStatusChange: (status) => {
        console.log(`[Ngrok] Status changed: ${status}`);
        if (status === "closed") {
          isConnected = false;
          console.warn("[Ngrok] Tunnel closed — attempting reconnect...");
          setTimeout(() => startNgrok(port), RETRY_DELAY_MS);
        }
      },
      onLogEvent: (data) => {
        if (process.env.NGROK_DEBUG === "true") {
          console.log("[Ngrok]", data);
        }
      },
    });

    publicUrl = url;
    isConnected = true;
    console.log(`[Ngrok] Tunnel active: ${url}`);
    return url;
  } catch (err) {
    console.error(`[Ngrok] Attempt ${attempt} failed:`, err.message);

    if (attempt < MAX_RETRIES) {
      console.log(`[Ngrok] Retrying in ${RETRY_DELAY_MS / 1000}s...`);
      await sleep(RETRY_DELAY_MS);
      return startNgrok(port, attempt + 1);
    }

    console.error("[Ngrok] All retry attempts exhausted. Backend running without tunnel.");
    return null;
  }
}

async function stopNgrok() {
  if (isConnected) {
    try {
      await ngrok.kill();
      publicUrl = null;
      isConnected = false;
      console.log("[Ngrok] Tunnel stopped");
    } catch (err) {
      console.error("[Ngrok] Error stopping tunnel:", err.message);
    }
  }
}

function getPublicUrl() {
  return publicUrl;
}

function isNgrokConnected() {
  return isConnected;
}

module.exports = { startNgrok, stopNgrok, getPublicUrl, isNgrokConnected };
