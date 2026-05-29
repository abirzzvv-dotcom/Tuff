# Ngrok Setup Guide

Ngrok creates a secure public HTTPS tunnel from the internet to your Termux backend. The Vercel frontend uses this URL to reach your backend.

## Why Ngrok?

Your Android phone doesn't have a public IP address — it's behind NAT/carrier networks. Ngrok creates a tunnel so that a URL like `https://xxxx.ngrok-free.app` forwards all traffic to your backend running on `localhost:5000`.

## 1. Create a Free Ngrok Account

1. Go to https://ngrok.com and click **Sign Up**
2. Verify your email address
3. You're on the free plan — this gives you:
   - 1 active tunnel at a time
   - 1 static domain (optional, see below)
   - HTTPS tunnel

## 2. Get Your Auth Token

1. Log in to https://dashboard.ngrok.com
2. Go to **Your Authtoken** (left sidebar)
3. Copy your token — it looks like: `2abc123xyz...`

## 3. Install Ngrok in Termux

```bash
# Method 1: npm package (recommended — already used by the backend)
# The backend uses the 'ngrok' npm package, so no separate install needed.
# Just set NGROK_AUTH_TOKEN in .env and the backend handles everything.

# Method 2: Install ngrok binary (optional, for manual testing)
pkg install wget -y
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-arm64.tgz
tar -xzf ngrok-v3-stable-linux-arm64.tgz
mv ngrok ~/bin/
chmod +x ~/bin/ngrok

# Add to PATH if needed
echo 'export PATH=$PATH:~/bin' >> ~/.bashrc
source ~/.bashrc

# Authenticate the binary
ngrok config add-authtoken YOUR_AUTH_TOKEN_HERE

# Verify
ngrok --version
```

## 4. Add Token to Backend .env

```bash
nano ~/termuxhost/backend/.env
```

Add or update:
```
NGROK_AUTH_TOKEN=your_auth_token_here
```

## 5. How the Backend Uses Ngrok

The backend automatically:
1. Waits for Express server to be listening
2. Calls `ngrok.connect({ addr: PORT })` with your auth token
3. Logs the public URL: `[Ngrok] Tunnel active: https://xxxx.ngrok-free.app`
4. Saves the URL and exposes it at `GET /api/tunnel`
5. Retries automatically if the connection drops (up to 5 times)

You can check the current tunnel URL any time:
```bash
curl http://localhost:5000/api/tunnel
```

Output:
```json
{
  "connected": true,
  "url": "https://xxxx-xx-xx-xx-xx.ngrok-free.app"
}
```

## 6. Manually Test Ngrok

After starting the backend, test the tunnel:

```bash
# Test health endpoint through ngrok
curl https://YOUR_NGROK_URL/api/health

# Expected response:
# {"status":"ok","timestamp":"...","version":"1.0.0"}
```

You can also visit the URL in a browser.

## 7. Update Vercel When URL Changes

**On the free plan, the ngrok URL changes every time the tunnel restarts.**

When the URL changes:
1. Check the new URL: `pm2 logs termuxhost | grep "Tunnel active"`
   Or check the Dashboard's tunnel badge.
2. Go to your Vercel project → Settings → Environment Variables
3. Update `VITE_API_URL` to the new ngrok URL
4. Redeploy: Vercel Dashboard → Deployments → Redeploy

### Get a Static Domain (Recommended)

Free ngrok accounts get **one free static domain**:
1. Go to https://dashboard.ngrok.com/cloud-edge/domains
2. Click **Create Domain** → get a domain like `yourname.ngrok-free.app`
3. Start the tunnel with your static domain:

In `.env`, you'd need to customize the ngrok config. Update `backend/src/config/ngrok.js`:

```javascript
const url = await ngrok.connect({
  addr: port,
  hostname: "yourname.ngrok-free.app",  // add this line
  // ...
});
```

With a static domain, the URL never changes — no Vercel redeployment needed.

## 8. Ngrok Inspector (Debug)

The ngrok npm package starts a local web inspector at `http://localhost:4040`:
- View all requests going through the tunnel
- Replay requests
- Inspect request/response headers and bodies

Open in a browser (if you have GUI access) or check the ngrok dashboard.

## Troubleshooting

**"auth token not valid" / "ERR_NGROK_105":**
- Re-copy your token from https://dashboard.ngrok.com/get-started/your-authtoken
- Ensure no spaces or newlines in `NGROK_AUTH_TOKEN`

**"limit of tunnels reached" / "ERR_NGROK_108":**
- Free plan only allows 1 tunnel at a time
- Kill any existing tunnels: https://dashboard.ngrok.com/tunnels
- Or wait a few minutes for old tunnel to expire

**Tunnel disconnects frequently:**
- This is normal on mobile networks — the backend auto-reconnects
- If it keeps failing: restart backend with `pm2 restart termuxhost`
- Check your mobile data connection stability

**Frontend gets CORS error through ngrok:**
- Ensure your Vercel URL is in `ALLOWED_ORIGINS` in backend `.env`
- Example: `ALLOWED_ORIGINS=https://yourapp.vercel.app`

**ngrok shows "ERR_NGROK_3200 — plan limit":**
- You've hit the free plan session limit (8 hours/session)
- Restart the tunnel: `pm2 restart termuxhost`
- Consider upgrading ngrok plan or using a static domain

**How the frontend connects to ngrok:**
The frontend reads `import.meta.env.VITE_API_URL` at build time.
Set this to your ngrok URL in Vercel's environment variables.
The frontend makes all API calls to `VITE_API_URL + /api/...`.
