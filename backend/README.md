# TermuxHost Backend

Express.js API server designed to run on **Termux (Android)** with PM2 process management, Neon PostgreSQL, Ngrok tunneling, and NVIDIA AI.

## Prerequisites

- Node.js ≥18 (install via `pkg install nodejs`)
- PM2: `npm install -g pm2`
- Ngrok installed and configured (see [../docs/NGROK_SETUP.md](../docs/NGROK_SETUP.md))
- Neon PostgreSQL database (see [../docs/NEON_SETUP.md](../docs/NEON_SETUP.md))

## Setup

```bash
# 1. Navigate to backend directory
cd backend

# 2. Install dependencies
npm install

# 3. Create .env file
cp .env.example .env
nano .env   # or: vi .env

# 4. Start the server
node src/index.js
```

## Environment Variables

Copy `.env.example` to `.env` and fill in all values:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | Neon PostgreSQL connection string |
| `PORT` | ✅ | Server port (default: 5000) |
| `ALLOWED_ORIGINS` | ✅ | Comma-separated list of allowed frontend URLs |
| `EMAIL_USER` | ✅ | Gmail address for sending emails |
| `EMAIL_PASS` | ✅ | Gmail App Password (NOT your Gmail password) |
| `NGROK_AUTH_TOKEN` | ✅ | Ngrok authentication token |
| `NVIDIA_API_KEY` | ✅ | NVIDIA API key for Gemma AI |
| `PROJECTS_DIR` | ❌ | Override projects storage directory |

## Running with PM2 (Production)

```bash
# Start with PM2
pm2 start src/index.js --name termuxhost

# Save PM2 process list (auto-restart on reboot)
pm2 save
pm2 startup

# View logs
pm2 logs termuxhost

# Stop
pm2 stop termuxhost

# Restart
pm2 restart termuxhost
```

## Startup Order

The server follows this exact startup sequence:
1. Load `.env` configuration
2. Connect to Neon PostgreSQL and run migrations
3. Start Express HTTP server on `PORT`
4. Wait for server to be listening
5. Start Ngrok tunnel and save public URL
6. Server ready

## API Routes

| Prefix | Description |
|--------|-------------|
| `GET /api/health` | Health check |
| `GET /api/tunnel` | Ngrok tunnel status and URL |
| `POST /api/auth/*` | Authentication routes |
| `GET/POST /api/projects/*` | Project management |
| `GET/POST /api/files/*` | File operations |
| `POST /api/ai/*` | AI assistant |
| `GET/POST /api/admin/*` | Admin routes |

See [../docs/API_DOCS.md](../docs/API_DOCS.md) for full documentation.

## Project Storage

User projects are stored in `~/projects/<project-id>/` by default.
Override with `PROJECTS_DIR` in `.env`.

Each project directory contains the actual project files and can be directly inspected or edited from Termux.

## Troubleshooting

**Database connection fails:**
- Verify `DATABASE_URL` in `.env`
- Check Neon dashboard for connection details
- Ensure `?sslmode=require` is in the URL

**Ngrok fails to start:**
- Verify `NGROK_AUTH_TOKEN` is correct
- Ensure ngrok is installed: `which ngrok`
- Check ngrok dashboard for active tunnels (free plan: 1 tunnel)

**PM2 not found:**
- Install globally: `npm install -g pm2`
- In Termux, you may need to add npm bin to PATH: `export PATH=$PATH:$(npm bin -g)`

**Port already in use:**
- Change `PORT` in `.env`
- Kill existing process: `fuser -k 5000/tcp`
