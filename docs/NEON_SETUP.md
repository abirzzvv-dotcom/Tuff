# Neon PostgreSQL Setup Guide

Neon is a serverless PostgreSQL service that works perfectly with Termux backends. It provides a free tier and auto-suspends when not in use.

## 1. Create a Neon Account

1. Go to https://neon.tech
2. Click **Sign Up** — use GitHub, Google, or email
3. A default project is created automatically

## 2. Create a Project

1. In the Neon Console, click **New Project** (or use the default one)
2. Name: `termuxhost`
3. Region: choose the closest to your location
4. PostgreSQL version: 16 (latest)
5. Click **Create Project**

## 3. Get the Connection String

1. In your project dashboard, click **Connection Details**
2. Select **Connection string** format
3. Under **Pooled connection**, copy the string — it looks like:
   ```
   postgresql://username:password@ep-cool-name-123456.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```
4. **Keep this string private — it contains your password**

## 4. Add to Backend .env

```bash
nano ~/termuxhost/backend/.env
```

Set:
```
DATABASE_URL=postgresql://username:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
```

## 5. Database Tables

The backend automatically creates all required tables on first startup via migrations. You don't need to run any SQL manually.

Tables created automatically:
- `users` — accounts, roles, verification status
- `sessions` — login tokens
- `projects` — hosted project metadata
- `logs` — project output logs
- `api_keys` — user API keys
- `ai_history` — AI chat conversations
- `verification_codes` — email verification and password reset codes

## 6. Verify Connection

After starting the backend, you should see:
```
[DB] Connected to Neon PostgreSQL
[DB] Migrations complete
```

## 7. Free Tier Limits

Neon free tier includes:
- **0.5 GB** storage
- **Compute auto-suspend** after 5 minutes of inactivity (resumes automatically on first query — adds ~500ms to the first request after idle)
- Unlimited projects

For most hobby use cases, the free tier is more than enough.

## Viewing Your Data

You can query your database directly from the Neon Console:
1. Go to your project → **SQL Editor**
2. Run queries like:
   ```sql
   SELECT id, username, email, role, created_at FROM users;
   SELECT id, name, type, status FROM projects;
   ```

## Troubleshooting

**"connection refused" or timeout:**
- Check your `DATABASE_URL` is correctly copied
- Neon auto-suspends — the first query after idle takes ~500ms, this is normal
- Try opening the Neon console to "wake up" the database

**"SSL required" error:**
- Ensure `?sslmode=require` is at the end of your connection string
- The backend already sets `ssl: { rejectUnauthorized: false }` for Neon compatibility

**"relation does not exist" error:**
- Migrations may have failed — check server logs: `pm2 logs termuxhost`
- Try restarting the backend to re-run migrations

**Database fills up (free tier):**
- Delete old logs: `DELETE FROM logs WHERE created_at < NOW() - INTERVAL '7 days';`
- Neon console → Storage to see usage
