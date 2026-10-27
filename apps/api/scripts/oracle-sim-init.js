import oracledb from 'oracledb';
import { readConfig } from '../src/config.js';
import { createOracleSource } from '../src/oracle-source.js';

const config = readConfig();
const adminPassword = process.env.ORACLE_ADMIN_PASSWORD;
const readerPassword = config.oracleSource.password;
if (!adminPassword || !/^[A-Za-z0-9]{16,64}$/.test(readerPassword || '')) {
  throw new Error('Set Oracle simulation passwords to 16–64 alphanumeric characters in the local .env');
}

const adminPool = await oracledb.createPool({
  user: 'SYSTEM',
  password: adminPassword,
  connectString: config.oracleSource.connectString,
  poolMin: 0,
  poolMax: 1,
  queueTimeout: 30_000,
});

try {
  const connection = await adminPool.getConnection();
  try {
    try {
      await connection.execute(`CREATE USER KADIS_SOURCE_READER IDENTIFIED BY "${readerPassword}"`);
    } catch (error) {
      if (error.errorNum !== 1920) throw error;
      await connection.execute(`ALTER USER KADIS_SOURCE_READER IDENTIFIED BY "${readerPassword}"`);
    }
    await connection.execute('GRANT CREATE SESSION TO KADIS_SOURCE_READER');
    try {
      await connection.execute(`
        CREATE TABLE SYSTEM.MONITORING_SOURCE_TEST (
          source_id VARCHAR2(64) PRIMARY KEY,
          metric_code VARCHAR2(128) NOT NULL,
          metric_value NUMBER(18,0) NOT NULL,
          data_mode VARCHAR2(8) NOT NULL,
          as_of TIMESTAMP WITH TIME ZONE NOT NULL
        )
      `);
    } catch (error) {
      if (error.errorNum !== 955) throw error;
    }
    await connection.execute(`
      MERGE INTO SYSTEM.MONITORING_SOURCE_TEST target
      USING (SELECT :source_id source_id, :metric_code metric_code FROM dual) source
      ON (target.source_id = source.source_id)
      WHEN MATCHED THEN UPDATE SET target.metric_code = source.metric_code,
        target.metric_value = 42, target.data_mode = 'DEMO', target.as_of = SYSTIMESTAMP
      WHEN NOT MATCHED THEN INSERT (source_id, metric_code, metric_value, data_mode, as_of)
        VALUES (source.source_id, source.metric_code, 42, 'DEMO', SYSTIMESTAMP)
    `, { source_id: 'monitoring_blangko', metric_code: 'stock_blanks' });
    await connection.execute(`
      CREATE OR REPLACE VIEW SYSTEM.MONITORING_SOURCE_SUMMARY_V AS
      SELECT source_id, metric_code, metric_value, data_mode, as_of
      FROM SYSTEM.MONITORING_SOURCE_TEST
    `);
    await connection.execute('GRANT SELECT ON SYSTEM.MONITORING_SOURCE_SUMMARY_V TO KADIS_SOURCE_READER');
    await connection.commit();
  } finally {
    await connection.close();
  }
} finally {
  await adminPool.close(5);
}

const reader = createOracleSource(config.oracleSource);
try {
  await reader.init();
  const rows = await reader.readSummaries();
  if (rows.length !== 1 || rows[0].sourceId !== 'monitoring_blangko' || rows[0].mode !== 'DEMO') {
    throw new Error('Oracle simulation view did not return its expected DEMO row');
  }
  process.stdout.write('Oracle Free simulation is connected through the backend read-only user.\n');
  process.stdout.write(`Read ${rows[0].sourceId}/${rows[0].metricCode} (${rows[0].mode}); sample value is intentionally not shown.\n`);
} finally {
  await reader.close();
}
