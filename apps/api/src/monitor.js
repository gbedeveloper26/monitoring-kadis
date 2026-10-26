const DEMO_CARDS = [
  {
    source: 'monitoring_server',
    label: 'Status Server',
    metric: null,
    value: null,
    mode: 'DEMO',
    connection: 'not_configured',
    freshness: 'no_data',
    serviceStatus: 'unknown',
    message: 'Belum terhubung — DEMO',
    asOf: null,
    checkedAt: null,
    lastSuccessAt: null,
  },
  {
    source: 'monitoring_blangko',
    label: 'Stok Blangko',
    metric: null,
    value: null,
    mode: 'DEMO',
    connection: 'not_configured',
    freshness: 'no_data',
    serviceStatus: 'unknown',
    message: 'Belum ada data — DEMO',
    asOf: null,
    checkedAt: null,
    lastSuccessAt: null,
  },
];

function allowedSourceUrl(raw, allowHttpSourceDev = false) {
  try {
    const url = new URL(raw);
    if (url.protocol === 'https:') return url;
    if (url.protocol === 'http:' && ['localhost', '127.0.0.1', '::1'].includes(url.hostname)) return url;
    if (url.protocol === 'http:' && allowHttpSourceDev) return url;
  } catch {
    // Invalid configuration is reported as not configured, never fetched.
  }
  return null;
}

async function fetchJson(url, token, fetchImpl) {
  const response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(5_000),
    redirect: 'error',
  });
  if (!response.ok) throw new Error(`Source HTTP ${response.status}`);
  const body = await response.text();
  if (Buffer.byteLength(body, 'utf8') > 16 * 1024) throw new Error('Source response too large');
  return JSON.parse(body);
}

export function createMonitor(config, { fetchImpl = fetch, now = () => Date.now() } = {}) {
  const state = new Map(config.sources.map((source) => [source.id, {
    source: source.id,
    label: source.label,
    metric: source.metric,
    value: null,
    mode: 'REAL',
    connection: 'not_configured',
    freshness: 'no_data',
    serviceStatus: 'unknown',
    message: 'Belum terhubung',
    asOf: null,
    checkedAt: null,
    lastSuccessAt: null,
    consecutiveHealthFailures: 0,
  }]));
  let polling = false;
  let timer = null;
  const listeners = new Set();

  function snapshot() {
    const timestamp = now();
    const cards = config.sources.map((source) => {
      const card = state.get(source.id);
      const { consecutiveHealthFailures: _internal, ...publicCard } = card;
      return {
        ...publicCard,
        freshness: card.lastSuccessAt && card.asOf
          ? timestamp - Math.min(Date.parse(card.lastSuccessAt), Date.parse(card.asOf)) <= config.staleAfterMs ? 'fresh' : 'stale'
          : 'no_data',
      };
    });
    return { generatedAt: new Date(timestamp).toISOString(), pollIntervalMs: config.pollIntervalMs, cards: [...cards, ...DEMO_CARDS] };
  }

  function publish() {
    const data = snapshot();
    for (const listener of listeners) listener(data);
  }

  async function checkHealth(source, card) {
    if (source.healthScope !== 'application' || !source.healthUrl) return 'unknown';
    const url = allowedSourceUrl(source.healthUrl, config.allowHttpSourceDev);
    if (!url) return 'unknown';
    try {
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(5_000), redirect: 'error' });
      if (response.ok) {
        card.consecutiveHealthFailures = 0;
        return 'normal';
      }
      card.consecutiveHealthFailures = 0;
      return 'gangguan';
    } catch {
      card.consecutiveHealthFailures += 1;
      return card.consecutiveHealthFailures >= 2 ? 'offline' : 'unknown';
    }
  }

  async function pollSource(source) {
    const card = state.get(source.id);
    const url = allowedSourceUrl(source.url, config.allowHttpSourceDev);
    card.checkedAt = new Date(now()).toISOString();
    if (!url || !source.token) {
      card.connection = 'not_configured';
      card.message = 'Belum terhubung';
      card.serviceStatus = 'unknown';
      return;
    }

    try {
      const body = await fetchJson(url, source.token, fetchImpl);
      const value = body?.data?.[source.field];
      if (body?.source !== source.id || body?.metric !== source.metric || body?.mode !== 'REAL'
          || !Number.isSafeInteger(value) || value < 0 || !Number.isFinite(Date.parse(body?.data?.as_of))
          || Date.parse(body.data.as_of) > now() + 5 * 60_000) {
        throw new Error('Invalid source payload');
      }
      card.value = value;
      card.asOf = body.data.as_of;
      card.lastSuccessAt = new Date(now()).toISOString();
      card.connection = 'connected';
      card.message = null;
    } catch {
      card.connection = 'error';
      card.message = card.lastSuccessAt ? 'Pembacaan gagal; menampilkan nilai terakhir' : 'Belum ada data';
    }
    card.serviceStatus = await checkHealth(source, card);
  }

  async function pollAll() {
    if (polling) return snapshot();
    polling = true;
    try {
      await Promise.all(config.sources.map(pollSource));
      publish();
      return snapshot();
    } finally {
      polling = false;
    }
  }

  function start() {
    if (timer) return;
    void pollAll();
    timer = setInterval(() => void pollAll(), config.pollIntervalMs);
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  return { snapshot, pollAll, start, stop, subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); } };
}
