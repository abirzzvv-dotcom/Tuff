# TermuxHost Frontend

React + Vite web app designed for deployment on **Vercel**. Communicates with the Termux backend via Ngrok tunnel URL.

## Stack

- React 18
- React Router DOM 6
- Vite 5
- Plain CSS (no CSS frameworks)
- Fetch API (no axios)

## Local Development

```bash
# 1. Navigate to frontend directory
cd frontend

# 2. Install dependencies
npm install

# 3. Create environment file
cp .env.example .env
# Edit .env and set VITE_API_URL to your backend URL

# 4. Start dev server
npm run dev
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Base URL of your backend (no trailing slash) |

**Development:** `http://localhost:5000` (or your Replit dev domain)  
**Production:** Your Ngrok public URL, e.g. `https://xxxx-xx-xx-xx-xx.ngrok-free.app`

> ⚠️ **Important:** The Ngrok URL changes every time the tunnel restarts (free plan). When it changes, update the `VITE_API_URL` in Vercel environment variables and redeploy.

## Building for Production

```bash
npm run build
```

Output goes to `dist/`. Upload to Vercel or any static host.

## Deploying to Vercel

See [../docs/VERCEL_DEPLOY.md](../docs/VERCEL_DEPLOY.md) for the complete guide.

**Quick steps:**
1. Push `frontend/` to a GitHub repository
2. Connect to Vercel
3. Set `VITE_API_URL` to your Ngrok URL
4. Deploy

## Pages

| Route | Description |
|-------|-------------|
| `/login` | Sign in |
| `/register` | Create account + email verification |
| `/dashboard` | Overview of projects and tunnel status |
| `/projects` | Create, start, stop, manage projects |
| `/projects/:id/editor` | File browser and code editor |
| `/projects/:id/logs` | Live log viewer |
| `/projects/:id/ai` | AI assistant scoped to project |
| `/ai` | General AI assistant |

## API Communication

All API calls use `import.meta.env.VITE_API_URL` as the base URL. No URLs are hardcoded.

```javascript
// src/utils/api.js
const BASE_URL = import.meta.env.VITE_API_URL || "";
```

This means:
- In Replit dev: set `VITE_API_URL` in Replit Secrets
- In Vercel: set `VITE_API_URL` in Vercel Environment Variables
- No source code changes needed between environments
