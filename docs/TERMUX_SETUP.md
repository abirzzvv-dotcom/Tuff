# Termux Setup Guide

Complete guide to running the TermuxHost backend on Android using Termux.

## 1. Install Termux

Download **Termux from F-Droid** (not the Play Store — the Play Store version is outdated):
- https://f-droid.org/en/packages/com.termux/

## 2. Initial Setup

Open Termux and run:

```bash
# Update package lists
pkg update && pkg upgrade -y

# Install essential tools
pkg install nodejs git nano curl wget -y

# Verify Node.js installation
node --version   # Should show v18+ or higher
npm --version
```

## 3. Install PM2

PM2 is the process manager used to keep your projects and the backend running:

```bash
npm install -g pm2

# Verify
pm2 --version
```

If you get a permission error:
```bash
npm install -g pm2 --prefix ~/.npm-global
export PATH=$PATH:~/.npm-global/bin
echo 'export PATH=$PATH:~/.npm-global/bin' >> ~/.bashrc
```

## 4. Install Python (optional, for Python projects)

```bash
pkg install python -y
pip install --upgrade pip

# Verify
python --version
pip --version
```

## 5. Clone or Copy the Backend

**Option A — Clone from GitHub:**
```bash
cd ~
git clone https://github.com/yourusername/termuxhost.git
cd termuxhost/backend
```

**Option B — Copy files manually:**
Copy the `/backend` folder to your phone and place it at `~/termuxhost/backend/`.

## 6. Configure Environment Variables

```bash
cd ~/termuxhost/backend
cp .env.example .env
nano .env
```

Fill in all required values:
- `DATABASE_URL` — from Neon dashboard
- `EMAIL_USER` and `EMAIL_PASS` — Gmail credentials
- `NGROK_AUTH_TOKEN` — from ngrok dashboard
- `NVIDIA_API_KEY` — from NVIDIA build portal
- `ALLOWED_ORIGINS` — your Vercel frontend URL

Save with `Ctrl+X`, then `Y`, then `Enter`.

## 7. Install Node.js Dependencies

```bash
cd ~/termuxhost/backend
npm install
```

This may take a few minutes on mobile.

## 8. Test the Backend

```bash
node src/index.js
```

You should see:
```
=== TermuxHost Backend Starting ===
[DB] Connected to Neon PostgreSQL
[DB] Migrations complete
[Server] Listening on port 5000
[Ngrok] Tunnel active: https://xxxx-xx-xx-xx-xx.ngrok-free.app
=== TermuxHost Backend Ready ===
```

Press `Ctrl+C` to stop.

## 9. Run with PM2 (Persistent)

```bash
cd ~/termuxhost/backend
pm2 start src/index.js --name termuxhost
pm2 save

# Check status
pm2 status

# View logs
pm2 logs termuxhost

# Restart
pm2 restart termuxhost

# Stop
pm2 stop termuxhost
```

## 10. Auto-Start on Termux Launch

To auto-start PM2 when you open Termux, add to `~/.bashrc`:

```bash
echo 'pm2 resurrect' >> ~/.bashrc
```

Or create a startup script:
```bash
# Create startup script
cat > ~/start-server.sh << 'EOF'
#!/bin/bash
cd ~/termuxhost/backend
pm2 resurrect || pm2 start src/index.js --name termuxhost
pm2 save
echo "Server started!"
EOF
chmod +x ~/start-server.sh
```

## 11. Keep Termux Running in Background

**Important:** Android may kill Termux when in background. To prevent this:

1. Go to **Android Settings → Battery** (or Battery Optimization)
2. Find **Termux** and set to **"Don't optimize"** or **"Unrestricted"**
3. On some phones: Settings → Apps → Termux → Battery → Background Activity → Allow

On some ROMs you may also need to lock Termux in Recent Apps.

## Useful Commands

```bash
# Check if server is running
pm2 status

# Check what's using port 5000
netstat -tlnp | grep 5000

# Kill process on port 5000
fuser -k 5000/tcp

# View Termux storage
df -h ~

# Update backend code
cd ~/termuxhost
git pull
cd backend
npm install
pm2 restart termuxhost
```

## Troubleshooting

**npm install fails:**
```bash
pkg install python build-essential -y
npm install --legacy-peer-deps
```

**"EACCES permission denied" on npm install:**
```bash
npm config set prefix '~/.npm-global'
export PATH=$PATH:~/.npm-global/bin
```

**Database connection times out:**
- Check your phone has internet access
- Verify `DATABASE_URL` is exactly as copied from Neon
- Neon pauses inactive databases — check the Neon dashboard

**Port 5000 already in use:**
- Change `PORT=5001` in `.env`
- Or kill: `fuser -k 5000/tcp`

**Ngrok auth token invalid:**
- Re-copy from: https://dashboard.ngrok.com/get-started/your-authtoken
- Make sure there are no extra spaces in `.env`
