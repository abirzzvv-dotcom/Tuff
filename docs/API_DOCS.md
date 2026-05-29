# API Documentation

All endpoints are prefixed with your backend URL (ngrok URL in production).

## Authentication

Most endpoints require a Bearer token in the `Authorization` header:

```
Authorization: Bearer <session-token>
```

Tokens are returned by `/api/auth/login` and valid for 30 days.

---

## Health

### `GET /api/health`
Returns server status. No authentication required.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0"
}
```

### `GET /api/tunnel`
Returns ngrok tunnel status and public URL. No authentication required.

**Response:**
```json
{
  "connected": true,
  "url": "https://xxxx-xx-xx-xx-xx.ngrok-free.app"
}
```

---

## Auth Routes (`/api/auth`)

### `POST /api/auth/register`
Create a new account. Sends a verification email.

**Body:**
```json
{
  "username": "cooluser",
  "email": "user@example.com",
  "password": "mypassword123"
}
```

**Response `201`:**
```json
{
  "message": "Account created. Check your email for the verification code.",
  "user": { "id": "uuid", "username": "cooluser", "email": "user@example.com" }
}
```

---

### `POST /api/auth/login`
Login and receive a session token.

**Body:**
```json
{
  "email": "user@example.com",
  "password": "mypassword123"
}
```

**Response `200`:**
```json
{
  "token": "uuid-session-token",
  "expiresAt": "2024-02-01T00:00:00.000Z",
  "user": {
    "id": "uuid",
    "username": "cooluser",
    "email": "user@example.com",
    "role": "user",
    "is_verified": true
  }
}
```

---

### `POST /api/auth/logout`
Invalidate the current session. **Requires auth.**

**Response `200`:** `{ "message": "Logged out" }`

---

### `POST /api/auth/verify-email`
Verify email with the 6-digit code sent after registration.

**Body:** `{ "email": "user@example.com", "code": "123456" }`

**Response `200`:** `{ "message": "Email verified successfully" }`

---

### `POST /api/auth/resend-verification`
Resend verification email. **Requires auth.**

**Response `200`:** `{ "message": "Verification code sent" }`

---

### `POST /api/auth/forgot-password`
Request a password reset code via email.

**Body:** `{ "email": "user@example.com" }`

**Response `200`:** `{ "message": "If this email exists, a reset code was sent." }`

---

### `POST /api/auth/reset-password`
Reset password using the code from email.

**Body:**
```json
{
  "email": "user@example.com",
  "code": "123456",
  "newPassword": "newpassword123"
}
```

**Response `200`:** `{ "message": "Password reset successful. Please log in again." }`

---

### `GET /api/auth/me`
Get current user info. **Requires auth.**

**Response `200`:**
```json
{
  "user": {
    "id": "uuid",
    "username": "cooluser",
    "email": "user@example.com",
    "role": "user",
    "is_verified": true
  }
}
```

---

## Projects Routes (`/api/projects`)

All project routes **require auth**. Start/stop/install routes also **require email verification**.

### `GET /api/projects`
List all projects for the current user.

**Response `200`:**
```json
{
  "projects": [
    {
      "id": "uuid",
      "name": "My Discord Bot",
      "type": "discord-node",
      "status": "running",
      "port": 3000,
      "entry_file": "index.js",
      "description": "A cool bot",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### `POST /api/projects`
Create a new project. **Requires verified email.**

**Body:**
```json
{
  "name": "My API",
  "type": "api",
  "description": "REST API server",
  "entryFile": "index.js",
  "port": 3000
}
```

**Valid types:** `nodejs`, `python`, `api`, `websocket`, `discord-node`, `discord-python`

**Response `201`:** `{ "project": { ... } }`

---

### `GET /api/projects/:id`
Get a specific project with PM2 status.

**Response `200`:**
```json
{
  "project": { "id": "uuid", "name": "...", "status": "running", ... },
  "pm2Status": {
    "name": "project-abc123",
    "status": "online",
    "cpu": 0.5,
    "memory": 12345678,
    "restarts": 0,
    "uptime": 1704067200000
  }
}
```

---

### `PUT /api/projects/:id`
Update project metadata.

**Body:** `{ "name": "...", "description": "...", "entryFile": "...", "port": 3000 }`

**Response `200`:** `{ "project": { ... } }`

---

### `DELETE /api/projects/:id`
Delete project and all its files.

**Response `200`:** `{ "message": "Project deleted" }`

---

### `POST /api/projects/:id/start`
Start the project with PM2. **Requires verified email.**

**Response `200`:** `{ "message": "Project started", "pm2Name": "project-abc123" }`

---

### `POST /api/projects/:id/stop`
Stop the project.

**Response `200`:** `{ "message": "Project stopped" }`

---

### `POST /api/projects/:id/restart`
Restart the project. **Requires verified email.**

**Response `200`:** `{ "message": "Project restarted", "pm2Name": "project-abc123" }`

---

### `POST /api/projects/:id/install-npm`
Install npm packages. **Requires verified email.**

**Body:** `{ "packages": ["express", "axios"] }`

**Response `200`:** `{ "message": "Packages installed", "output": "..." }`

---

### `POST /api/projects/:id/install-pip`
Install pip packages. **Requires verified email.**

**Body:** `{ "packages": ["requests", "flask"] }`

**Response `200`:** `{ "message": "Packages installed", "output": "..." }`

---

### `GET /api/projects/:id/logs`
Get project logs.

**Query params:** `?limit=100` (max 500)

**Response `200`:**
```json
{
  "logs": [
    { "content": "Server started on port 3000", "log_type": "info", "created_at": "..." }
  ]
}
```

---

## Files Routes (`/api/files`)

All file routes **require auth**. Write/delete operations also **require verified email**.

### `GET /api/files/:projectId/list`
List files in a directory.

**Query:** `?path=src` (optional subdirectory)

**Response `200`:**
```json
{
  "files": [
    { "name": "index.js", "type": "file", "path": "index.js", "size": 1024 },
    { "name": "src", "type": "directory", "path": "src", "size": null }
  ]
}
```

---

### `GET /api/files/:projectId/read`
Read file contents.

**Query:** `?path=src/index.js` (required)

**Response `200`:** `{ "content": "const app = ...", "path": "src/index.js" }`

---

### `POST /api/files/:projectId/write`
Create or overwrite a file. **Requires verified email.**

**Body:** `{ "path": "src/index.js", "content": "const app = ..." }`

**Response `200`:** `{ "message": "File saved", "path": "src/index.js" }`

---

### `DELETE /api/files/:projectId/delete`
Delete a file or directory. **Requires verified email.**

**Body:** `{ "path": "src/old-file.js" }`

**Response `200`:** `{ "message": "Deleted", "path": "src/old-file.js" }`

---

### `POST /api/files/:projectId/mkdir`
Create a directory. **Requires verified email.**

**Body:** `{ "path": "src/utils" }`

**Response `200`:** `{ "message": "Directory created", "path": "src/utils" }`

---

### `POST /api/files/:projectId/rename`
Rename or move a file/directory. **Requires verified email.**

**Body:** `{ "oldPath": "src/old.js", "newPath": "src/new.js" }`

**Response `200`:** `{ "message": "Renamed", "oldPath": "...", "newPath": "..." }`

---

### `POST /api/files/:projectId/upload`
Upload files (multipart/form-data). **Requires verified email.**

**Form fields:**
- `files` — file(s) to upload (up to 20, max 10MB each)
- `path` — optional target directory

**Response `200`:** `{ "message": "Files uploaded", "files": ["file1.js", "file2.js"] }`

---

## AI Routes (`/api/ai`)

All AI routes **require auth and verified email**.

### `POST /api/ai/chat`
Send a message to the AI assistant.

**Body:**
```json
{
  "message": "Create a REST API endpoint for user authentication",
  "projectId": "uuid-optional"
}
```

**Response `200`:**
```json
{
  "response": "I'll create an authentication endpoint...\n<ACTION>...</ACTION>",
  "actions": [
    { "type": "create_file", "path": "routes/auth.js", "content": "...", "explanation": "..." }
  ],
  "actionResults": [
    { "action": "create_file", "path": "routes/auth.js", "success": true }
  ]
}
```

---

### `GET /api/ai/history`
Get chat history.

**Query:** `?projectId=uuid&limit=50`

**Response `200`:**
```json
{
  "history": [
    { "id": "uuid", "message": "...", "response": "...", "created_at": "..." }
  ]
}
```

---

### `DELETE /api/ai/history`
Clear chat history.

**Query:** `?projectId=uuid` (optional)

**Response `200`:** `{ "message": "History cleared" }`

---

## Admin Routes (`/api/admin`)

All admin routes **require auth and admin role**.

### `GET /api/admin/stats`
Platform-wide statistics.

**Response `200`:**
```json
{
  "totalUsers": 42,
  "totalProjects": 128,
  "runningProjects": 7,
  "totalLogs": 9823
}
```

---

### `GET /api/admin/users`
List all users. **Query:** `?page=1&limit=20`

### `POST /api/admin/users/:id/suspend`
Suspend a user (invalidates all sessions).

### `POST /api/admin/users/:id/unsuspend`
Re-enable a suspended user.

### `POST /api/admin/users/:id/promote`
Promote user to admin role.

### `POST /api/admin/users/:id/demote`
Remove admin role from user.

### `DELETE /api/admin/users/:id`
Permanently delete a user and all their data.

### `GET /api/admin/projects`
List all projects across all users. **Query:** `?page=1&limit=20`

### `POST /api/admin/projects/:id/stop`
Force stop any project.

### `DELETE /api/admin/projects/:id`
Delete any project and its files.

---

## Error Responses

All endpoints return errors in this format:

```json
{ "error": "Human-readable error message" }
```

| Status | Meaning |
|--------|---------|
| 400 | Bad request — missing or invalid fields |
| 401 | Unauthorized — no token or expired session |
| 403 | Forbidden — email not verified or account suspended |
| 404 | Not found |
| 409 | Conflict — duplicate username/email |
| 413 | Payload too large |
| 500 | Internal server error |
