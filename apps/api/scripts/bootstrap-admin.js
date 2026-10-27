import pg from 'pg';
import { hashPassword } from '../src/auth.js';

const { Pool } = pg;
const { DATABASE_URL, BOOTSTRAP_ADMIN_USERNAME, BOOTSTRAP_ADMIN_PASSWORD, BOOTSTRAP_ADMIN_DISPLAY_NAME } = process.env;
if (!DATABASE_URL || !BOOTSTRAP_ADMIN_USERNAME || !BOOTSTRAP_ADMIN_PASSWORD || !BOOTSTRAP_ADMIN_DISPLAY_NAME) {
  throw new Error('Set DATABASE_URL, BOOTSTRAP_ADMIN_USERNAME, BOOTSTRAP_ADMIN_PASSWORD, and BOOTSTRAP_ADMIN_DISPLAY_NAME');
}
if (BOOTSTRAP_ADMIN_PASSWORD.length < 12 || BOOTSTRAP_ADMIN_PASSWORD.length > 128) {
  throw new Error('Bootstrap password must be between 12 and 128 characters');
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 5_000,
  application_name: 'monitoring-kadis-admin-bootstrap',
  ...(process.env.PG_SSL === 'true' ? { ssl: { rejectUnauthorized: true } } : {}),
});

try {
  const admins = await pool.query("SELECT count(*)::int AS count FROM public.monitoring_users WHERE role = 'admin' AND is_active = true");
  if (admins.rows[0].count > 0) throw new Error('An active admin already exists; bootstrap is only for the first admin');
  const passwordHash = await hashPassword(BOOTSTRAP_ADMIN_PASSWORD);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(`
    INSERT INTO public.monitoring_users (username, display_name, password_hash, role, assigned_sources, is_active)
    VALUES ($1, $2, $3, 'admin', '{}', true)
    RETURNING id
  `, [BOOTSTRAP_ADMIN_USERNAME, BOOTSTRAP_ADMIN_DISPLAY_NAME, passwordHash]);
    await client.query(`
    INSERT INTO public.monitoring_audit_log (actor_user_id, action, target_user_id, details)
    VALUES (NULL, 'user.bootstrap', $1, '{"role":"admin"}'::jsonb)
  `, [result.rows[0].id]);
    await client.query('COMMIT');
    process.stdout.write('Initial admin account created. Remove bootstrap credentials from the environment.\n');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* Preserve the original error. */ }
    throw error;
  } finally {
    client.release();
  }
} catch (error) {
  throw error;
} finally {
  await pool.end();
}
