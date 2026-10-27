import oracledb from 'oracledb';

const VIEW_PATTERN = /^(?:[A-Za-z][A-Za-z0-9_$#]*\.)?[A-Za-z][A-Za-z0-9_$#]*$/;

export function createOracleSource(config, driver = oracledb) {
  if (!config.enabled) return null;
  if (!config.username || !config.password || !config.connectString) throw new Error('Oracle source connection is incomplete');
  if (!VIEW_PATTERN.test(config.viewName)) throw new Error('Oracle source view name is invalid');
  if (!Array.isArray(config.sourceIds) || config.sourceIds.length === 0
      || config.sourceIds.length > 20
      || config.sourceIds.some((id) => !/^[a-z][a-z0-9_]{1,63}$/.test(id))) {
    throw new Error('ORACLE_SOURCE_IDS must contain 1–20 valid source IDs');
  }

  let pool;
  async function init() {
    pool = await driver.createPool({
      user: config.username,
      password: config.password,
      connectString: config.connectString,
      poolMin: 0,
      poolMax: 2,
      poolIncrement: 1,
      queueTimeout: 30_000,
    });
    await ping();
  }

  async function withConnection(callback) {
    if (!pool) throw new Error('Oracle source pool is not initialized');
    const connection = await pool.getConnection();
    try { return await callback(connection); }
    finally { await connection.close(); }
  }

  async function ping() {
    return withConnection(async (connection) => {
      const result = await connection.execute('SELECT 1 AS "ok" FROM dual');
      if (Number(result.rows?.[0]?.[0]) !== 1) throw new Error('Oracle ping failed');
    });
  }

  async function readSummaries() {
    const binds = {};
    const placeholders = config.sourceIds.map((sourceId, index) => {
      const name = `source_${index}`;
      binds[name] = sourceId;
      return `:${name}`;
    });
    const sql = `
      SELECT source_id AS "sourceId", metric_code AS "metricCode",
             metric_value AS "value", data_mode AS "mode", as_of AS "asOf"
      FROM ${config.viewName}
      WHERE source_id IN (${placeholders.join(', ')})
    `;
    return withConnection(async (connection) => {
      const result = await connection.execute(sql, binds, { outFormat: driver.OUT_FORMAT_OBJECT });
      const rows = result.rows || [];
      const seen = new Set();
      return rows.map((row) => {
        const sourceId = row.sourceId ?? row.SOURCEID;
        const metricCode = row.metricCode ?? row.METRICCODE;
        const value = Number(row.value ?? row.VALUE);
        const mode = row.mode ?? row.MODE;
        const asOf = row.asOf ?? row.ASOF;
        if (!config.sourceIds.includes(sourceId) || seen.has(sourceId)
            || typeof metricCode !== 'string' || !/^[a-z][a-z0-9_]{1,127}$/.test(metricCode)
            || !Number.isSafeInteger(value) || value < 0 || !['REAL', 'DEMO'].includes(mode)
            || !Number.isFinite(Date.parse(asOf instanceof Date ? asOf.toISOString() : asOf))) {
          throw new Error('Oracle summary view returned an invalid row');
        }
        seen.add(sourceId);
        return { sourceId, metricCode, value, mode, asOf };
      });
    });
  }

  return { init, ping, readSummaries, async close() { if (pool) await pool.close(10); pool = null; } };
}
