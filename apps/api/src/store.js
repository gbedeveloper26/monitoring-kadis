import pg from 'pg';
import { readFileSync } from 'node:fs';

const { Pool } = pg;

export function createStore(config) {
  if (!config.databaseUrl) throw new Error('DATABASE_URL is required');
  const ssl = config.databaseSsl
    ? { rejectUnauthorized: true, ...(config.databaseSslCaPath ? { ca: readFileSync(config.databaseSslCaPath, 'utf8') } : {}) }
    : undefined;
  const pool = new Pool({
    connectionString: config.databaseUrl,
    max: config.databasePoolMax,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    application_name: 'monitoring-kadis-api',
    ...(ssl ? { ssl } : {}),
  });
  pool.on('error', () => {
    process.stderr.write('PostgreSQL pool reported an idle client error.\n');
  });

  async function init() {
    await pool.query('SELECT 1');
    const schema = await pool.query(`
      SELECT to_regclass('public.monitoring_snapshots') AS snapshots,
             to_regclass('public.monitoring_webhook_events') AS events,
             to_regclass('public.monitoring_snapshot_history') AS history,
             to_regclass('public.monitoring_users') AS users,
             to_regclass('public.monitoring_sessions') AS sessions,
             to_regclass('public.monitoring_audit_log') AS audit_log
    `);
    if (!schema.rows[0]?.snapshots || !schema.rows[0]?.events || !schema.rows[0]?.history
        || !schema.rows[0]?.users || !schema.rows[0]?.sessions || !schema.rows[0]?.audit_log) {
      throw new Error('Monitoring database schema is missing; run npm run db:migrate');
    }
  }

  async function saveSnapshot(snapshot) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const updated = await persistSnapshot(client, snapshot);
      await client.query('COMMIT');
      return updated;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async function persistSnapshot(client, snapshot) {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1)::bigint)', [snapshot.source]);
    const current = await client.query(`
      SELECT snapshot->>'asOf' AS "asOf"
      FROM public.monitoring_snapshots
      WHERE source = $1
      FOR UPDATE
    `, [snapshot.source]);
    if (current.rows[0]?.asOf && Date.parse(current.rows[0].asOf) > Date.parse(snapshot.asOf)) return false;
    await client.query(`
      INSERT INTO public.monitoring_snapshots (source, snapshot, updated_at)
      VALUES ($1, $2::jsonb, now())
      ON CONFLICT (source) DO UPDATE SET snapshot = EXCLUDED.snapshot, updated_at = now()
    `, [snapshot.source, JSON.stringify(snapshot)]);
    await client.query(`
      INSERT INTO public.monitoring_snapshot_history (source, metric, value, as_of, recorded_at, mode)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [snapshot.source, snapshot.metric, snapshot.value, snapshot.asOf, snapshot.receivedAt, snapshot.mode]);
    return true;
  }

  return {
    init,
    async ping() { await pool.query('SELECT 1'); },
    async close() { await pool.end(); },
    async getSnapshots() {
      const result = await pool.query('SELECT snapshot FROM public.monitoring_snapshots ORDER BY source');
      return result.rows.map((row) => row.snapshot);
    },
    saveSnapshot,
    async hasEvent(source, eventId) {
      const result = await pool.query(
        'SELECT 1 FROM public.monitoring_webhook_events WHERE source = $1 AND event_id = $2',
        [source, eventId],
      );
      return result.rowCount > 0;
    },
    async getEvents(limit = 500) {
      const result = await pool.query(`
        SELECT source, event_id AS "eventId", received_at AS "receivedAt"
        FROM public.monitoring_webhook_events
        ORDER BY received_at DESC
        LIMIT $1
      `, [Math.min(Math.max(Number(limit) || 500, 1), 500)]);
      return result.rows;
    },
    async findUserByUsername(username) {
      const result = await pool.query(`
        SELECT id, username, display_name AS "displayName", password_hash AS "passwordHash",
               role, assigned_sources AS "assignedSources", is_active AS "isActive"
        FROM public.monitoring_users
        WHERE lower(username) = lower($1)
        LIMIT 1
      `, [username]);
      return result.rows[0] || null;
    },
    async getSessionUser(tokenHash) {
      const result = await pool.query(`
        SELECT u.id, u.username, u.display_name AS "displayName", u.role,
               u.assigned_sources AS "assignedSources"
        FROM public.monitoring_sessions s
        JOIN public.monitoring_users u ON u.id = s.user_id
        WHERE s.token_hash = $1 AND s.expires_at > now() AND u.is_active = true
      `, [tokenHash]);
      return result.rows[0] || null;
    },
    async createSession(tokenHash, userId, expiresAt) {
      await pool.query('DELETE FROM public.monitoring_sessions WHERE expires_at <= now()');
      await pool.query(`
        INSERT INTO public.monitoring_sessions (token_hash, user_id, expires_at)
        VALUES ($1, $2, $3)
      `, [tokenHash, userId, expiresAt]);
    },
    async deleteSession(tokenHash) {
      await pool.query('DELETE FROM public.monitoring_sessions WHERE token_hash = $1', [tokenHash]);
    },
    async listUsers() {
      const result = await pool.query(`
        SELECT id, username, display_name AS "displayName", role,
               assigned_sources AS "assignedSources", is_active AS "isActive",
               created_at AS "createdAt", updated_at AS "updatedAt"
        FROM public.monitoring_users ORDER BY id
      `);
      return result.rows;
    },
    async createUser(user, actorId) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query(`
          INSERT INTO public.monitoring_users
            (username, display_name, password_hash, role, assigned_sources, is_active)
          VALUES ($1, $2, $3, $4, $5, true)
          RETURNING id, username, display_name AS "displayName", role,
                    assigned_sources AS "assignedSources", is_active AS "isActive",
                    created_at AS "createdAt", updated_at AS "updatedAt"
        `, [user.username, user.displayName, user.passwordHash, user.role, user.assignedSources]);
        await client.query(`
          INSERT INTO public.monitoring_audit_log (actor_user_id, action, target_user_id, details)
          VALUES ($1, 'user.created', $2, $3::jsonb)
        `, [actorId, result.rows[0].id, JSON.stringify({ role: user.role, assignedSources: user.assignedSources })]);
        await client.query('COMMIT');
        return result.rows[0];
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async updateUser(id, user, actorId) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query(`
          UPDATE public.monitoring_users
          SET display_name = $2, role = $3, assigned_sources = $4,
              is_active = $5, updated_at = now()
          WHERE id = $1
          RETURNING id, username, display_name AS "displayName", role,
                    assigned_sources AS "assignedSources", is_active AS "isActive",
                    created_at AS "createdAt", updated_at AS "updatedAt"
        `, [id, user.displayName, user.role, user.assignedSources, user.isActive]);
        if (!result.rows[0]) {
          await client.query('ROLLBACK');
          return null;
        }
        await client.query('DELETE FROM public.monitoring_sessions WHERE user_id = $1', [id]);
        await client.query(`
          INSERT INTO public.monitoring_audit_log (actor_user_id, action, target_user_id, details)
          VALUES ($1, 'user.updated', $2, $3::jsonb)
        `, [actorId, id, JSON.stringify({ role: user.role, assignedSources: user.assignedSources, isActive: user.isActive })]);
        await client.query('COMMIT');
        return result.rows[0];
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async updatePassword(id, passwordHash, actorId) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query(`
          UPDATE public.monitoring_users SET password_hash = $2, updated_at = now()
          WHERE id = $1 RETURNING id
        `, [id, passwordHash]);
        if (!result.rows[0]) {
          await client.query('ROLLBACK');
          return false;
        }
        await client.query('DELETE FROM public.monitoring_sessions WHERE user_id = $1', [id]);
        await client.query(`
          INSERT INTO public.monitoring_audit_log (actor_user_id, action, target_user_id)
          VALUES ($1, 'user.password_reset', $2)
        `, [actorId, id]);
        await client.query('COMMIT');
        return true;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async getAuditLog(limit = 500) {
      const result = await pool.query(`
        SELECT a.id, a.actor_user_id AS "actorUserId", actor.username AS "actorUsername",
               a.action, a.target_user_id AS "targetUserId", target.username AS "targetUsername",
               a.details, a.created_at AS "createdAt"
        FROM public.monitoring_audit_log a
        LEFT JOIN public.monitoring_users actor ON actor.id = a.actor_user_id
        LEFT JOIN public.monitoring_users target ON target.id = a.target_user_id
        ORDER BY a.created_at DESC LIMIT $1
      `, [Math.min(Math.max(Number(limit) || 500, 1), 500)]);
      return result.rows;
    },
    async getHistory(source, limit = 3000) {
      const result = await pool.query(`
        SELECT source, metric, value, as_of AS "asOf", recorded_at AS "recordedAt", mode
        FROM public.monitoring_snapshot_history
        WHERE source = $1 AND recorded_at >= now() - interval '1 day'
        ORDER BY recorded_at ASC
        LIMIT $2
      `, [source, Math.min(Math.max(Number(limit) || 3000, 1), 3000)]);
      return result.rows.map((row) => ({ ...row, value: Number(row.value) }));
    },
    async saveEvent(source, eventId, receivedAt) {
      const result = await pool.query(`
        INSERT INTO public.monitoring_webhook_events (source, event_id, received_at)
        VALUES ($1, $2, $3)
        ON CONFLICT (source, event_id) DO NOTHING
        RETURNING event_id
      `, [source, eventId, receivedAt]);
      return result.rowCount === 1;
    },
    async saveWebhook(source, eventId, receivedAt, snapshot) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const inserted = await client.query(`
          INSERT INTO public.monitoring_webhook_events (source, event_id, received_at)
          VALUES ($1, $2, $3)
          ON CONFLICT (source, event_id) DO NOTHING
          RETURNING event_id
        `, [source, eventId, receivedAt]);
        if (inserted.rowCount === 0) {
          await client.query('COMMIT');
          return 'duplicate';
        }
        const updated = await persistSnapshot(client, snapshot);
        await client.query('COMMIT');
        return updated ? 'saved' : 'stale';
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
