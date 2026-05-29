require("dotenv").config();
const app = require("./app");
const { connectDatabase } = require("./config/database");
const { startNgrok } = require("./config/ngrok");

const PORT = parseInt(process.env.PORT || "5000", 10);

async function main() {
  console.log("=== TermuxHost Backend Starting ===");

  // Step 1: Connect database
  try {
    await connectDatabase();
  } catch (err) {
    console.error("[Startup] Database connection failed:", err.message);
    process.exit(1);
  }

  // Step 2: Start Express server
  const server = app.listen(PORT, "0.0.0.0", async () => {
    console.log(`[Server] Listening on port ${PORT}`);

    // Step 3: Start ngrok AFTER server is ready
    if (process.env.NGROK_AUTH_TOKEN) {
      const publicUrl = await startNgrok(PORT);
      if (publicUrl) {
        console.log(`[Server] Public URL: ${publicUrl}`);
        console.log(`[Server] Frontend API URL: ${publicUrl}`);
      }
    } else {
      console.log("[Ngrok] Skipped — NGROK_AUTH_TOKEN not set");
    }

    console.log("=== TermuxHost Backend Ready ===");
  });

  server.on("error", (err) => {
    console.error("[Server] Fatal error:", err.message);
    process.exit(1);
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`\n[Server] ${signal} received — shutting down...`);
    const { stopNgrok } = require("./config/ngrok");
    await stopNgrok();
    server.close(() => {
      console.log("[Server] HTTP server closed");
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("[Startup] Fatal error:", err);
  process.exit(1);
});
