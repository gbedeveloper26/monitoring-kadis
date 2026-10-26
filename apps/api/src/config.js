const sources = [
  {
    id: 'inventory_aset',
    label: 'Inventory Aset',
    metric: 'total_assets',
    field: 'total_assets',
    urlEnv: 'INVENTORY_SUMMARY_URL',
    tokenEnv: 'INVENTORY_READ_TOKEN',
    healthEnv: 'INVENTORY_HEALTH_URL',
    healthScope: 'application',
  },
  {
    id: 'antrian_umum',
    label: 'Antrian Umum',
    metric: 'total_queues_today',
    field: 'total_queues_today',
    urlEnv: 'QUEUE_UMUM_SUMMARY_URL',
    tokenEnv: 'QUEUE_UMUM_READ_TOKEN',
    healthEnv: 'QUEUE_UMUM_HEALTH_URL',
    healthScope: 'application',
  },
  {
    id: 'antrian_ptsp',
    label: 'Antrian PTSP',
    metric: 'total_queues_today',
    field: 'total_queues_today',
    urlEnv: 'QUEUE_PTSP_SUMMARY_URL',
    tokenEnv: 'QUEUE_PTSP_READ_TOKEN',
    healthEnv: 'QUEUE_PTSP_HEALTH_URL',
    healthScope: 'application',
  },
  {
    id: 'mitra_pks',
    label: 'Mitra Aktif',
    metric: 'active_partners',
    field: 'active_partners',
    urlEnv: 'SIPONCAN_MITRA_SUMMARY_URL',
    tokenEnv: 'SIPONCAN_READ_TOKEN',
    healthScope: 'unknown',
  },
  {
    id: 'app_mobile',
    label: 'Pengguna Mobile Terdaftar',
    metric: 'registered_mobile_users',
    field: 'registered_mobile_users',
    urlEnv: 'SIPONCAN_MOBILE_SUMMARY_URL',
    tokenEnv: 'SIPONCAN_READ_TOKEN',
    healthScope: 'unknown',
  },
];

export function readConfig(env = process.env) {
  const pollIntervalMs = Math.max(5_000, Number(env.POLL_INTERVAL_MS) || 30_000);
  const staleAfterMs = Math.max(pollIntervalMs, Number(env.STALE_AFTER_MS) || 120_000);
  return {
    host: env.API_HOST || '127.0.0.1',
    port: Number(env.API_PORT) || 4000,
    webOrigin: env.WEB_ORIGIN || 'http://127.0.0.1:3001',
    pollIntervalMs,
    staleAfterMs,
    allowHttpSourceDev: env.NODE_ENV !== 'production' && env.ALLOW_HTTP_SOURCE_DEV === 'true',
    sources: sources.map((source) => ({
      ...source,
      url: env[source.urlEnv] || '',
      token: env[source.tokenEnv] || '',
      healthUrl: source.healthEnv ? env[source.healthEnv] || '' : '',
    })),
  };
}
