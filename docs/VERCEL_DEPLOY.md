# Vercel Deployment Guide

Deploy the TermuxHost frontend to Vercel for free. The frontend is a static React + Vite app.

## Prerequisites

- GitHub account
- Vercel account (https://vercel.com — sign up with GitHub)
- Backend running in Termux with ngrok tunnel active
- Your ngrok public URL ready

## Method 1: Deploy from GitHub (Recommended)

### Step 1: Push Frontend to GitHub

```bash
# Create a new GitHub repo named "termuxhost-frontend"
# Then push only the frontend folder:

cd /path/to/termuxhost
git init frontend-deploy
cp -r frontend/* frontend-deploy/
cd frontend-deploy
git init
git add .
git commit -m "Initial frontend deployment"
git remote add origin https://github.com/yourusername/termuxhost-frontend.git
git push -u origin main
```

Or simply copy the `frontend/` folder contents into a new repository.

### Step 2: Connect to Vercel

1. Go to https://vercel.com/dashboard
2. Click **Add New → Project**
3. Import your `termuxhost-frontend` repository
4. Vercel auto-detects **Vite** — no framework config needed

### Step 3: Configure Environment Variables

Before clicking Deploy, expand **Environment Variables** and add:

| Name | Value |
|------|-------|
| `VITE_API_URL` | `https://xxxx-xx-xx-xx-xx.ngrok-free.app` |

> Use your actual current ngrok URL. No trailing slash.

### Step 4: Deploy

Click **Deploy**. Vercel builds in ~30 seconds and gives you a URL like `https://termuxhost-frontend.vercel.app`.

### Step 5: Test

1. Visit your Vercel URL
2. Register an account
3. Check the tunnel badge in the top-right corner — it should show "Tunnel active"

## Method 2: Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy from frontend directory
cd frontend
vercel

# Follow prompts:
# - Link to existing project or create new
# - Set VITE_API_URL when prompted

# Production deploy
vercel --prod
```

## Updating VITE_API_URL When Ngrok URL Changes

Free ngrok URLs change on every restart. Here's how to update:

1. Get the new ngrok URL from your backend logs:
   ```bash
   pm2 logs termuxhost | grep "Tunnel active"
   # or check the Dashboard tunnel badge
   ```

2. In Vercel: Project → **Settings** → **Environment Variables**
3. Edit `VITE_API_URL` → paste new ngrok URL
4. Go to **Deployments** tab → click the three dots on latest deploy → **Redeploy**

> ⚠️ Tip: Get a free static ngrok domain to avoid this step. See [NGROK_SETUP.md](NGROK_SETUP.md#7-get-a-static-domain-recommended)

## Custom Domain (Optional)

1. In Vercel project → **Settings** → **Domains**
2. Add your domain (e.g., `termuxhost.yourdomain.com`)
3. Follow Vercel's DNS instructions
4. Add your custom domain to `ALLOWED_ORIGINS` in backend `.env`:
   ```
   ALLOWED_ORIGINS=https://termuxhost.yourdomain.com
   ```
5. Restart backend: `pm2 restart termuxhost`

## Vercel Build Settings

These are auto-detected but for reference:

| Setting | Value |
|---------|-------|
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |

## Environment Variables Reference

| Variable | Where to Set | Description |
|----------|-------------|-------------|
| `VITE_API_URL` | Vercel Environment Variables | Ngrok public URL of your backend |

In development (Replit or local):
- Set in Replit Secrets: `VITE_API_URL` = your Replit dev domain or `http://localhost:5000`
- Set in `.env` file: `VITE_API_URL=http://localhost:5000`

## Troubleshooting

**Build fails "VITE_API_URL not defined":**
- Add `VITE_API_URL` in Vercel environment variables before deploying
- Rebuild the deployment after adding it

**Frontend loads but API calls fail (CORS error):**
- Add your Vercel URL to `ALLOWED_ORIGINS` in backend `.env`
- Restart backend: `pm2 restart termuxhost`

**"Failed to fetch" / network error:**
- Check your ngrok tunnel is running: `pm2 status`
- Verify `VITE_API_URL` matches the current ngrok URL exactly
- Ngrok may have restarted — update the URL in Vercel and redeploy

**Old URLs cached:**
- Vercel uses CDN caching
- Hard refresh the page: `Ctrl+Shift+R`
- Or redeploy from Vercel dashboard
