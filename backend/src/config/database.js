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
      key_value VARCHAR(255) UNIQUE NOT NULL,
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

  await client.query("CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)");
  await client.query("CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)");
  await client.query("CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)");
  await client.query("CREATE INDEX IF NOT EXISTS idx_logs_project_id ON logs(project_id)");
  await client.query("CREATE INDEX IF NOT EXISTS idx_api_keys_key_value ON api_keys(key_value)");
  await client.query("CREATE INDEX IF NOT EXISTS idx_ai_history_user_id ON ai_history(user_id)");
  await client.query("CREATE INDEX IF NOT EXISTS idx_verification_codes_user_id ON verification_codes(user_id)");

  console.log("[DB] Migrations complete");
}

module.exports = { pool, connectDatabase };
