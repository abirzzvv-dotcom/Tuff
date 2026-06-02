const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  console.error("[DB] Unexpected pool error:", err.message);
});

async function connectDatabase() {
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
    console.log("[DB] Connected to Neon PostgreSQL");
    await runMigrations(client);
  } finally {
    client.release();
  }
}

async function safeQuery(client, sql, label) {
  try {
    await client.query(sql);
  } catch (err) {
    console.warn(`[DB] ${label} skipped: ${err.message}`);
  }
}

async function runMigrations(client) {
  console.log("[DB] Running migrations...");

  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) DEFAULT 'user',
      is_verified BOOLEAN DEFAULT false,
      is_suspended BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token VARCHAR(255) UNIQUE NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      type VARCHAR(50) NOT NULL,
      status VARCHAR(20) DEFAULT 'stopped',
      port INTEGER,
      pm2_id VARCHAR(100),
      entry_file VARCHAR(255),
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      log_type VARCHAR(20) DEFAULT 'info',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key_value VARCHAR(255) NOT NULL,
      name VARCHAR(100) NOT NULL,
      last_used TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS ai_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
      message TEXT NOT NULL,
      response TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS verification_codes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code VARCHAR(10) NOT NULL,
      type VARCHAR(30) NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Reconcile columns that may be missing from old table schemas
  await safeQuery(client,
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false",
    "ALTER users.is_suspended");
  await safeQuery(client,
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()",
    "ALTER users.updated_at");
  await safeQuery(client,
    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS pm2_id VARCHAR(100)",
    "ALTER projects.pm2_id");
  await safeQuery(client,
    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS entry_file VARCHAR(255)",
    "ALTER projects.entry_file");
  await safeQuery(client,
    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS description TEXT",
    "ALTER projects.description");
  await safeQuery(client,
    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()",
    "ALTER projects.updated_at");
  await safeQuery(client,
    "ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS key_value VARCHAR(255)",
    "ALTER api_keys.key_value");
  await safeQuery(client,
    "ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS last_used TIMESTAMPTZ",
    "ALTER api_keys.last_used");

  // Indexes — each wrapped so one failure does not abort startup
  await safeQuery(client,
    "CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)",
    "idx_sessions_token");
  await safeQuery(client,
    "CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)",
    "idx_sessions_user_id");
  await safeQuery(client,
    "CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)",
    "idx_projects_user_id");
  await safeQuery(client,
    "CREATE INDEX IF NOT EXISTS idx_logs_project_id ON logs(project_id)",
    "idx_logs_project_id");
  await safeQuery(client,
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_key_value ON api_keys(key_value) WHERE key_value IS NOT NULL",
    "idx_api_keys_key_value");
  await safeQuery(client,
    "CREATE INDEX IF NOT EXISTS idx_ai_history_user_id ON ai_history(user_id)",
    "idx_ai_history_user_id");
  await safeQuery(client,
    "CREATE INDEX IF NOT EXISTS idx_verification_codes_user_id ON verification_codes(user_id)",
    "idx_verification_codes_user_id");

  console.log("[DB] Migrations complete");
}

module.exports = { pool, connectDatabase };
