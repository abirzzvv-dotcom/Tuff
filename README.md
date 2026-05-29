# TermuxHost

A self-hosted project management platform designed for Android Termux backends, Vercel frontends, and Neon PostgreSQL databases.

## Architecture

```
┌─────────────────────────┐        ┌──────────────────────────┐
│   Vercel (Frontend)     │◄──────►│   Ngrok Tunnel           │
│   React + Vite          │        │   Public HTTPS URL        │
│   /frontend             │        └──────────┬───────────────┘
└─────────────────────────┘                   │
                                              ▼
                                   ┌──────────────────────────┐
                                   │  Termux (Android)        │
                                   │  Node.js + Express       │
                                   │  /backend                │
                                   └──────────┬───────────────┘
                                              │
                                              ▼
                                   ┌──────────────────────────┐
                                   │  Neon PostgreSQL          │
                                   │  Cloud Database           │
                                   └──────────────────────────┘
```

## Repository Layout

```
/backend    — Express API server (deploy to Termux)
/frontend   — React + Vite app (deploy to Vercel)
```

## Quick Start

### 1. Set up Neon PostgreSQL
See [docs/NEON_SETUP.md](docs/NEON_SETUP.md)

### 2. Set up the Backend in Termux
See [backend/README.md](backend/README.md) and [docs/TERMUX_SETUP.md](docs/TERMUX_SETUP.md)

### 3. Set up Ngrok
See [docs/NGROK_SETUP.md](docs/NGROK_SETUP.md)

### 4. Deploy Frontend to Vercel
See [frontend/README.md](frontend/README.md) and [docs/VERCEL_DEPLOY.md](docs/VERCEL_DEPLOY.md)

## Documentation Index

| File | Description |
|------|-------------|
| [backend/README.md](backend/README.md) | Backend setup and configuration |
| [frontend/README.md](frontend/README.md) | Frontend setup and Vercel deployment |
| [docs/TERMUX_SETUP.md](docs/TERMUX_SETUP.md) | Complete Termux installation guide |
| [docs/NGROK_SETUP.md](docs/NGROK_SETUP.md) | Ngrok tunnel setup and troubleshooting |
| [docs/NEON_SETUP.md](docs/NEON_SETUP.md) | Neon PostgreSQL setup |
| [docs/GMAIL_SETUP.md](docs/GMAIL_SETUP.md) | Gmail SMTP / App Password setup |
| [docs/VERCEL_DEPLOY.md](docs/VERCEL_DEPLOY.md) | Vercel deployment guide |
| [docs/API_DOCS.md](docs/API_DOCS.md) | Full REST API documentation |

## Features

- **User authentication** — register, login, email verification, password reset
- **Project management** — create, start, stop, restart projects with PM2
- **Project types** — Node.js, Python, Discord bots (Node/Python), REST APIs, WebSocket servers
- **File manager** — browse, create, edit, delete, upload, rename files
- **Package installer** — npm and pip packages directly from the UI
- **Log viewer** — real-time project logs with auto-refresh
- **AI assistant** — Gemma 3n via NVIDIA, can create/edit/delete project files
- **Admin panel** — manage users, suspend accounts, monitor all projects
- **Ngrok integration** — auto-tunneling with retry and reconnect handling
