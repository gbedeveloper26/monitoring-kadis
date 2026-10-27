import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import pg from 'pg';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required to run migrations');

const pool = new Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: 5_000,
  application_name: 'monitoring-kadis-migrations',
  ...(process.env.PG_SSL === 'true' ? {
    ssl: {
      rejectUnauthorized: true,
      ...(process.env.PG_SSL_CA_PATH ? { ca: readFileSync(process.env.PG_SSL_CA_PATH, 'utf8') } : {}),
    },
  } : {}),
});

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.monitoring_schema_migrations (
      version varchar(128) PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  const migrationsUrl = new URL('../migrations/', import.meta.url);
  const migrationFiles = (await readdir(fileURLToPath(migrationsUrl)))
    .filter((name) => /^\d+_[a-z0-9_-]+\.sql$/.test(name))
    .sort();
  for (const filename of migrationFiles) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const applied = await client.query(
        'SELECT 1 FROM public.monitoring_schema_migrations WHERE version = $1',
        [filename],
      );
      if (applied.rowCount > 0) {
        await client.query('COMMIT');
        continue;
      }
      const migrationUrl = new URL(filename, migrationsUrl);
      const migration = await readFile(fileURLToPath(migrationUrl), 'utf8');
      await client.query(migration);
      await client.query('INSERT INTO public.monitoring_schema_migrations (version) VALUES ($1)', [filename]);
      await client.query('COMMIT');
      process.stdout.write(`Applied ${filename}\n`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  process.stdout.write('Monitoring Kadis PostgreSQL schema is ready.\n');
} finally {
  await pool.end();
}
