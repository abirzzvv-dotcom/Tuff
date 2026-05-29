# TermuxHost

A self-hosted project management platform — backend runs on Termux (Android), frontend deploys to Vercel, database on Neon PostgreSQL.

## Run & Operate

- Replit is for **development only** — preview frontend via the Vite dev server
- Backend (`/backend`) runs on **Termux** in production
- Frontend (`/frontend`) deploys to **Vercel** in production

## Stack

- **Frontend:** React 18 + Vite 5 + plain CSS + Fetch API (no extra UI libs)
- **Backend:** Node.js 18+ + Express 5, bcryptjs, Nodemailer, ngrok npm package
- **Database:** Neon PostgreSQL (pg driver, migrations auto-run on startup)
- **Process mgr:** PM2 (runs on Termux)
- **Tunneling:** Ngrok (exposes Termux backend to the internet)
- **AI:** NVIDIA Gemma 3n (`google/gemma-3n-e4b-it`) via NVIDIA NIM API

## Where things live

```
/backend                  — Express API server (Termux deploy)
  src/index.js            — Startup: DB → server.listen → ngrok
  src/app.js              — Express app, CORS, routes
  src/config/database.js  — Neon PostgreSQL pool + auto-migrations
  src/config/ngrok.js     — Ngrok connect/retry/reconnect logic
  src/routes/auth.js      — Register, login, sessions, verification, password reset
  src/routes/projects.js  — Project CRUD + start/stop/restart (PM2)
  src/routes/files.js     — File read/write/delete/upload/mkdir/rename
  src/routes/ai.js        — AI chat (Gemma 3n), history, clear
  src/routes/admin.js     — User management, project oversight
  src/services/email.js   — Gmail SMTP via Nodemailer
  src/services/projectRunner.js — PM2 integration, package install
  src/services/ai.js      — NVIDIA API calls + file action execution
  .env.example            — All env var documentation

/frontend                 — React + Vite app (Vercel deploy)
  src/utils/api.js        — All API calls via import.meta.env.VITE_API_URL
  src/pages/Login.jsx     — Login + inline email verify flow
  src/pages/Register.jsx  — Register + code verification step
  src/pages/Dashboard.jsx — Stats, recent projects, tunnel URL
  src/pages/Projects.jsx  — Full project management (create/start/stop/delete/packages)
  src/pages/FileEditor.jsx — File tree + code editor (Tab indent, Ctrl+S save)
  src/pages/Logs.jsx      — Project logs with live auto-refresh
  src/pages/AIAssistant.jsx — Gemma AI chat with file action display
  src/components/Layout.jsx — Sidebar nav, topbar, tunnel status badge

/docs                     — Setup and reference guides
  TERMUX_SETUP.md         — Complete Termux installation guide
  NGROK_SETUP.md          — Ngrok setup, static domain, troubleshooting
  NEON_SETUP.md           — Neon PostgreSQL setup
  GMAIL_SETUP.md          — Gmail App Password setup
  VERCEL_DEPLOY.md        — Vercel deployment + env vars guide
  API_DOCS.md             — Full REST API documentation with examples
```

## Architecture decisions

- **No ORM** — raw `pg` queries for minimal Termux footprint; migrations run automatically
- **bcryptjs** (not bcrypt) — pure JS, no native bindings, required for Android Termux
- **Sessions in DB** — token stored in `sessions` table; no JWT, no cookies
- **VITE_API_URL** — all frontend API calls use this env var; no hardcoded URLs anywhere
- **Ngrok starts after** `server.listen` callback — guaranteed server is ready before tunneling

## User preferences

- Production backend: Termux on Android
- Production frontend: Vercel
- Development: Replit (frontend preview only)
- No Docker, no Kubernetes, no native modules
- Lightweight and Termux-compatible dependencies only

## Gotchas

- Ngrok free plan: URL changes on every restart — update `VITE_API_URL` in Vercel and redeploy
- Gmail App Password required (not regular password) — see `docs/GMAIL_SETUP.md`
- `bcrypt` (native) will fail on Termux — project uses `bcryptjs` (pure JS) correctly
- PM2 must be installed globally before starting projects: `npm install -g pm2`
- Neon auto-suspends after 5 min idle — first query after idle takes ~500ms
- `ALLOWED_ORIGINS` in backend `.env` must include your Vercel URL for CORS to work
