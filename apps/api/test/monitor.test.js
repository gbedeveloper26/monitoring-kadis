import test from 'node:test';
import assert from 'node:assert/strict';
import { createMonitor } from '../src/monitor.js';

const baseTime = Date.parse('2026-10-23T10:00:00Z');
const source = {
  id: 'antrian_umum', label: 'Antrian Umum', metric: 'total_queues_today',
  field: 'total_queues_today', url: 'http://127.0.0.1:8080/api/v1/monitoring/queue/summary',
  token: 'only-in-test', healthScope: 'unknown', healthUrl: '',
};
const config = { sources: [source], staleAfterMs: 120_000, pollIntervalMs: 30_000 };

function response(body) {
  return { ok: true, text: async () => JSON.stringify(body) };
}

test('sumber belum dikonfigurasi tidak mengarang angka', async () => {
  const monitor = createMonitor({ ...config, sources: [{ ...source, url: '', token: '' }] }, {
    now: () => baseTime,
    fetchImpl: () => { throw new Error('fetch must not run'); },
  });
  const data = await monitor.pollAll();
  assert.equal(data.cards[0].value, null);
  assert.equal(data.cards[0].connection, 'not_configured');
  assert.equal(data.cards[1].mode, 'DEMO');
  assert.equal(data.cards[1].value, null);
});

test('nol valid dari sumber tetap nol, bukan Belum ada data', async () => {
  const monitor = createMonitor(config, {
    now: () => baseTime,
    fetchImpl: async () => response({
      source: 'antrian_umum', mode: 'REAL', metric: 'total_queues_today',
      data: { total_queues_today: 0, as_of: '2026-10-23T10:00:00Z' },
    }),
  });
  const data = await monitor.pollAll();
  assert.equal(data.cards[0].value, 0);
  assert.equal(data.cards[0].freshness, 'fresh');
  assert.equal(data.cards[0].connection, 'connected');
  assert.equal(JSON.stringify(data).includes('only-in-test'), false);
});

test('payload dengan source lain ditolak dan nilai terakhir tidak dihapus', async () => {
  let attempt = 0;
  const monitor = createMonitor(config, {
    now: () => baseTime,
    fetchImpl: async () => response({
      source: ++attempt === 1 ? 'antrian_umum' : 'antrian_ptsp',
      mode: 'REAL', metric: 'total_queues_today',
      data: { total_queues_today: 12, as_of: '2026-10-23T10:00:00Z' },
    }),
  });
  await monitor.pollAll();
  const data = await monitor.pollAll();
  assert.equal(data.cards[0].value, 12);
  assert.equal(data.cards[0].connection, 'error');
});

test('as_of lama ditandai stale meski API baru berhasil dibaca', async () => {
  const monitor = createMonitor(config, {
    now: () => baseTime,
    fetchImpl: async () => response({
      source: 'antrian_umum', mode: 'REAL', metric: 'total_queues_today',
      data: { total_queues_today: 3, as_of: '2026-10-23T09:55:00Z' },
    }),
  });
  const data = await monitor.pollAll();
  assert.equal(data.cards[0].freshness, 'stale');
});

test('dua kegagalan health beruntun memberi status offline tanpa menghapus angka', async () => {
  const monitor = createMonitor({ ...config, sources: [{ ...source, healthScope: 'application', healthUrl: 'http://127.0.0.1:8080/health' }] }, {
    now: () => baseTime,
    fetchImpl: async (url) => {
      if (String(url).endsWith('/health')) throw new Error('timeout');
      return response({
        source: 'antrian_umum', mode: 'REAL', metric: 'total_queues_today',
        data: { total_queues_today: 4, as_of: '2026-10-23T10:00:00Z' },
      });
    },
  });
  const first = await monitor.pollAll();
  assert.equal(first.cards[0].serviceStatus, 'unknown');
  const second = await monitor.pollAll();
  assert.equal(second.cards[0].serviceStatus, 'offline');
  assert.equal(second.cards[0].value, 4);
});
