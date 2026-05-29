const express = require("express");
const cors = require("cors");
const { getPublicUrl, isNgrokConnected } = require("./config/ngrok");

const authRouter = require("./routes/auth");
const projectsRouter = require("./routes/projects");
const filesRouter = require("./routes/files");
const aiRouter = require("./routes/ai");
const adminRouter = require("./routes/admin");

const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.length === 0) return callback(null, true);
      if (allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
        return callback(null, true);
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use((req, res, next) => {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${req.method} ${req.path}`);
  next();
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

app.get("/api/tunnel", (req, res) => {
  res.json({
    connected: isNgrokConnected(),
    url: getPublicUrl(),
  });
});

app.use("/api/auth", authRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/files", filesRouter);
app.use("/api/ai", aiRouter);
app.use("/api/admin", adminRouter);

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error("[App] Unhandled error:", err.message);
  res.status(500).json({ error: "Internal server error" });
});

module.exports = app;
