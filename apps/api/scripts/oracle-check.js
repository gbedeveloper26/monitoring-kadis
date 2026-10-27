import { readConfig } from '../src/config.js';
import { createOracleSource } from '../src/oracle-source.js';

const config = readConfig();
const source = createOracleSource(config.oracleSource);
if (!source) throw new Error('Set ORACLE_SOURCE_ENABLED=true to run the Oracle connection check');

try {
  await source.init();
  const rows = await source.readSummaries();
  process.stdout.write(`Oracle connection succeeded; view returned ${rows.length} row(s).\n`);
  for (const row of rows) {
    const asOf = row.asOf instanceof Date ? row.asOf.toISOString() : String(row.asOf);
    process.stdout.write(`${row.sourceId} | ${row.metricCode} | ${row.mode} | ${asOf}\n`);
  }
} finally {
  await source.close();
}
