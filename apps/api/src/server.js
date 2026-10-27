import http from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { WebSocketServer } from 'ws';
import { createAuth, hashPassword, verifyPassword } from './auth.js';
import { createOracleSource } from './oracle-source.js';
import { readConfig } from './config.js';
import { createMonitor } from './monitor.js';
import { createStore } from './store.js';

const config = readConfig();
const store = createStore(config);
await store.init();
const auth = createAuth(store, { cookieSecure: config.cookieSecure });
const oracleSource = createOracleSource(config.oracleSource);
if (oracleSource) await oracleSource.init();
const monitor = createMonitor(config, {
  initialSnapshots: await store.getSnapshots(),
  onSnapshot: (snapshot) => store.saveSnapshot(snapshot),
});

const MAX_BODY_BYTES = 16 * 1024;
const EVENT_TYPES = {
  inventory_aset: ['inventory.assets.snapshot_updated', 'total_assets'],
  mitra_pks: ['mitra.active.snapshot_updated', 'active_partners'],
  app_mobile: ['mobile.users.snapshot_updated', 'registered_mobile_users'],
  antrian_umum: ['queue.snapshot_updated', 'total_queues_today'],
  antrian_ptsp: ['queue.snapshot_updated', 'total_queues_today'],
};
const VALID_ROLES = new Set(['kadis', 'admin', 'petugas']);
const loginAttempts = new Map();

function send(response, status, body) {
  response.writeHead(status);
  response.end(JSON.stringify(body));
}

function hasPermission(user, permission) {
  return Boolean(user && (user.permissions || []).includes(permission));
}

function trustedOrigin(request) {
  return request.headers.origin === config.webOrigin;
}

function parseJson(raw) {
  if (!raw.length) return null;
  try { return JSON.parse(raw.toString('utf8')); } catch { return null; }
}

function validPassword(password) {
  return typeof password === 'string' && password.length >= 12 && password.length <= 128;
}

function normalizeUserInput(body, allowedSources) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const { username, displayName, role } = body;
  const assignedSources = body.assignedSources ?? [];
  if (typeof username !== 'string' || !/^[A-Za-z0-9._-]{3,64}$/.test(username)
      || typeof displayName !== 'string' || displayName.trim().length < 2 || displayName.trim().length > 120
      || !VALID_ROLES.has(role) || !Array.isArray(assignedSources)
      || assignedSources.some((source) => typeof source !== 'string' || !allowedSources.has(source))) return null;
  if (role === 'petugas' ? assignedSources.length === 0 : assignedSources.length !== 0) return null;
  return { username, displayName: displayName.trim(), role, assignedSources: [...new Set(assignedSources)] };
}

async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error('Payload too large'), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJsonBody(request, response) {
  if (!String(request.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
    send(response, 415, { message: 'Expected application/json' });
    return undefined;
  }
  let raw;
  try { raw = await readBody(request); } catch (error) {
    send(response, error.status === 413 ? 413 : 400, { message: error.status === 413 ? 'Payload too large' : 'Invalid request body' });
    return undefined;
  }
  const body = parseJson(raw);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    send(response, 400, { message: 'Invalid JSON body' });
    return undefined;
  }
  return body;
}

function validWebhook(event, source) {
  const expected = EVENT_TYPES[source];
  if (!expected || event?.source !== source || event?.type !== expected[0]
      || event?.schema_version !== '1.0' || event?.mode !== 'REAL') return false;
  const eventId = event.source_event_id || event.event_id;
  if (typeof eventId !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(eventId)) return false;
  if (!Number.isFinite(Date.parse(event.occurred_at)) || !event.payload || Array.isArray(event.payload)) return false;
  if (!Number.isSafeInteger(event.payload[expected[1]]) || event.payload[expected[1]] < 0) return false;
  if (!Number.isFinite(Date.parse(event.payload.as_of))) return false;
  return { eventId, valueField: expected[1] };
}

async function receiveWebhook(request, response) {
  const source = request.url.split('/').at(-1);
  const credential = config.webhookCredentials[source];
  if (!credential || Buffer.byteLength(credential.secret) < 32) return send(response, 503, { message: 'Webhook source is not configured' });
  if (!String(request.headers['content-type'] || '').toLowerCase().startsWith('application/json')) return send(response, 415, { message: 'Expected application/json' });
  const keyId = request.headers['x-monitoring-key-id'];
  const timestamp = request.headers['x-monitoring-timestamp'];
  const signature = request.headers['x-monitoring-signature'];
  if (typeof keyId !== 'string' || keyId !== credential.keyId || !/^[A-Za-z0-9_-]{1,64}$/.test(keyId)
      || typeof timestamp !== 'string' || !/^\d{10,13}$/.test(timestamp)
      || typeof signature !== 'string' || !/^(?:sha256=)?[a-f0-9]{64}$/.test(signature)) {
    return send(response, 401, { message: 'Invalid webhook authentication' });
  }
  const timestampMs = Number(timestamp) * (timestamp.length === 10 ? 1000 : 1);
  if (Math.abs(Date.now() - timestampMs) > config.webhookMaxClockSkewMs) return send(response, 401, { message: 'Webhook timestamp expired' });

  let raw;
  try { raw = await readBody(request); } catch (error) { return send(response, error.status || 400, { message: error.status === 413 ? 'Payload too large' : 'Invalid request body' }); }
  const expectedSignature = createHmac('sha256', credential.secret).update(`${timestamp}.${raw.toString('utf8')}`).digest('hex');
  const supplied = Buffer.from(signature.replace(/^sha256=/, ''));
  const expectedBuffer = Buffer.from(expectedSignature);
  if (supplied.length !== expectedBuffer.length || !timingSafeEqual(supplied, expectedBuffer)) return send(response, 401, { message: 'Invalid webhook authentication' });

  let event;
  try { event = JSON.parse(raw.toString('utf8')); } catch { return send(response, 400, { message: 'Invalid JSON' }); }
  const validation = validWebhook(event, source);
  if (!validation) return send(response, 422, { message: 'Invalid webhook event' });
  if (await store.hasEvent(source, validation.eventId)) return send(response, 200, { accepted: true, duplicate: true });

  const receivedAt = new Date().toISOString();
  const currentCard = monitor.snapshot().cards.find((card) => card.source === source);
  if (currentCard?.asOf && Date.parse(event.payload.as_of) < Date.parse(currentCard.asOf)) {
    try {
      const saved = await store.saveEvent(source, validation.eventId, receivedAt);
      return send(response, saved ? 202 : 200, { accepted: true, duplicate: !saved, stale: true });
    } catch {
      return send(response, 503, { message: 'Event could not be stored' });
    }
  }
  const snapshot = {
    source,
    metric: config.sources.find((candidate) => candidate.id === source).metric,
    value: event.payload[validation.valueField],
    asOf: event.payload.as_of,
    receivedAt,
    lastSuccessAt: receivedAt,
    checkedAt: receivedAt,
    connection: 'connected',
    mode: event.mode,
  };
  try {
    const result = await store.saveWebhook(source, validation.eventId, receivedAt, snapshot);
    if (result === 'duplicate') return send(response, 200, { accepted: true, duplicate: true });
    if (result === 'stale') return send(response, 202, { accepted: true, duplicate: false, stale: true });
    monitor.applyWebhookSnapshot(event, { persist: false });
    return send(response, 202, { accepted: true, duplicate: false });
  } catch {
    return send(response, 503, { message: 'Event could not be stored' });
  }
}

const server = http.createServer((request, response) => {
  void handleRequest(request, response).catch((error) => {
    if (process.env.NODE_ENV !== 'production') {
      process.stderr.write(`Request failed: ${error.name} (${error.code || 'no-code'}): ${error.message}\n`);
    }
    if (response.headersSent) return response.destroy();
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    send(response, 503, { message: 'Service temporarily unavailable' });
  });
});

async function handleRequest(request, response) {
  const origin = request.headers.origin;
  if (origin && origin === config.webOrigin) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Vary', 'Origin');
  }
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');

  if (request.method === 'OPTIONS' && trustedOrigin(request)) {
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method === 'GET' && request.url === '/health') {
    send(response, 200, { status: 'up', mode: process.env.NODE_ENV === 'production' ? 'production' : 'development', generatedAt: new Date().toISOString() });
    return;
  }
  if (request.method === 'GET' && request.url === '/ready') {
    try {
      await store.ping();
      if (oracleSource) await oracleSource.ping();
      send(response, 200, { status: 'ready' });
    } catch {
      send(response, 503, { status: 'not_ready' });
    }
    return;
  }
  if (request.method === 'POST' && request.url === '/api/v1/auth/login') {
    if (!trustedOrigin(request)) return send(response, 403, { message: 'Untrusted origin' });
    const body = await readJsonBody(request, response);
    if (!body) return;
    if (typeof body.username !== 'string' || body.username.length > 64 || !validPassword(body.password)) {
      return send(response, 400, { message: 'Invalid username or password format' });
    }
    const ip = request.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = loginAttempts.get(ip);
    if (entry && now - entry.start < 15 * 60_000 && entry.count >= 5) {
      response.setHeader('Retry-After', String(Math.ceil((15 * 60_000 - (now - entry.start)) / 1000)));
      return send(response, 429, { message: 'Too many login attempts' });
    }
    try {
      const session = await auth.login(body.username, body.password);
      if (!session) {
        if (!entry || now - entry.start >= 15 * 60_000) loginAttempts.set(ip, { start: now, count: 1 });
        else entry.count += 1;
        return send(response, 401, { message: 'Invalid credentials' });
      }
      loginAttempts.delete(ip);
      response.setHeader('Set-Cookie', auth.setCookie(session.token));
      send(response, 200, { user: auth.userPayload(session.user), expiresAt: session.expiresAt });
    } catch {
      send(response, 503, { message: 'Authentication service unavailable' });
    }
    return;
  }
  if (request.method === 'POST' && request.url === '/api/v1/auth/logout') {
    if (!trustedOrigin(request)) return send(response, 403, { message: 'Untrusted origin' });
    try {
      await auth.logout(request);
      response.setHeader('Set-Cookie', auth.clearCookie);
      send(response, 200, { loggedOut: true });
    } catch {
      send(response, 503, { message: 'Logout failed' });
    }
    return;
  }
  if (request.method === 'GET' && request.url === '/api/v1/auth/me') {
    try {
      const user = await auth.authenticate(request);
      if (!user) return send(response, 401, { message: 'Authentication required' });
      send(response, 200, { user: auth.userPayload(user) });
    } catch {
      send(response, 503, { message: 'Authentication service unavailable' });
    }
    return;
  }
  if (request.method === 'POST' && request.url === '/api/v1/auth/password') {
    if (!trustedOrigin(request)) return send(response, 403, { message: 'Untrusted origin' });
    try {
      const user = await auth.authenticate(request);
      if (!user) return send(response, 401, { message: 'Authentication required' });
      const body = await readJsonBody(request, response);
      if (!body) return;
      if (typeof body.currentPassword !== 'string' || !validPassword(body.newPassword)) return send(response, 400, { message: 'Password must be between 12 and 128 characters' });
      const stored = await store.findUserByUsername(user.username);
      if (!stored || !(await verifyPassword(body.currentPassword, stored.passwordHash))) return send(response, 401, { message: 'Current password is incorrect' });
      await store.updatePassword(user.id, await hashPassword(body.newPassword), user.id);
      response.setHeader('Set-Cookie', auth.clearCookie);
      send(response, 200, { passwordChanged: true, reauthenticationRequired: true });
    } catch {
      send(response, 503, { message: 'Password update failed' });
    }
    return;
  }
  if (request.method === 'GET' && request.url === '/api/v1/dashboard') {
    send(response, 200, monitor.snapshot());
    return;
  }
  if (request.method === 'GET' && request.url.startsWith('/api/v1/dashboard/history')) {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    const source = url.searchParams.get('source');
    const limit = url.searchParams.has('limit') ? Number(url.searchParams.get('limit')) : 3000;
    if (!config.sources.some((candidate) => candidate.id === source) || !Number.isInteger(limit) || limit < 1 || limit > 3000) {
      return send(response, 400, { message: 'Invalid source or limit' });
    }
    try {
      send(response, 200, { source, points: await store.getHistory(source, limit) });
    } catch {
      send(response, 503, { message: 'History is unavailable' });
    }
    return;
  }
  if (request.method === 'POST' && /^\/api\/v1\/ingest\/events\/[a-z0-9_]+$/.test(request.url)) {
    try { await receiveWebhook(request, response); } catch { send(response, 503, { message: 'Webhook could not be processed' }); }
    return;
  }
  if (request.method === 'GET' && request.url === '/api/v1/admin/events') {
    const user = await auth.authenticate(request);
    if (!user) return send(response, 401, { message: 'Authentication required' });
    if (!hasPermission(auth.userPayload(user), 'events:read')) return send(response, 403, { message: 'Forbidden' });
    try {
      send(response, 200, { events: await store.getEvents() });
    } catch {
      send(response, 503, { message: 'Event log is unavailable' });
    }
    return;
  }
  if (request.method === 'GET' && request.url === '/api/v1/internal/sources') {
    const user = await auth.authenticate(request);
    if (!user) return send(response, 401, { message: 'Authentication required' });
    const payload = auth.userPayload(user);
    if (!hasPermission(payload, 'sources:inspect') && !hasPermission(payload, 'assigned-sources:inspect')) return send(response, 403, { message: 'Forbidden' });
    const visible = payload.role === 'admin'
      ? monitor.snapshot().cards.filter((card) => card.mode !== 'DEMO')
      : monitor.snapshot().cards.filter((card) => payload.assignedSources.includes(card.source));
    send(response, 200, { sources: visible.map(({ source, label, connection, freshness, serviceStatus, checkedAt, lastSuccessAt }) => ({ source, label, connection, freshness, serviceStatus, checkedAt, lastSuccessAt })) });
    return;
  }
  if (request.method === 'GET' && request.url === '/api/v1/internal/oracle-summaries') {
    const user = await auth.authenticate(request);
    if (!user) return send(response, 401, { message: 'Authentication required' });
    if (!hasPermission(auth.userPayload(user), 'sources:inspect')) return send(response, 403, { message: 'Forbidden' });
    if (!oracleSource) return send(response, 503, { message: 'Oracle source is not configured' });
    try { send(response, 200, { summaries: await oracleSource.readSummaries() }); }
    catch { send(response, 503, { message: 'Oracle source is unavailable' }); }
    return;
  }
  if (request.method === 'GET' && request.url === '/api/v1/admin/users') {
    const user = await auth.authenticate(request);
    if (!user) return send(response, 401, { message: 'Authentication required' });
    if (!hasPermission(auth.userPayload(user), 'users:manage')) return send(response, 403, { message: 'Forbidden' });
    try { send(response, 200, { users: await store.listUsers() }); }
    catch { send(response, 503, { message: 'User directory is unavailable' }); }
    return;
  }
  if (request.method === 'POST' && request.url === '/api/v1/admin/users') {
    if (!trustedOrigin(request)) return send(response, 403, { message: 'Untrusted origin' });
    const actor = await auth.authenticate(request);
    if (!actor) return send(response, 401, { message: 'Authentication required' });
    if (!hasPermission(auth.userPayload(actor), 'users:manage')) return send(response, 403, { message: 'Forbidden' });
    const body = await readJsonBody(request, response);
    if (!body) return;
    const user = normalizeUserInput(body, new Set(config.sources.map((source) => source.id)));
    if (!user || !validPassword(body.password)) return send(response, 400, { message: 'Invalid user fields or password policy' });
    try {
      const created = await store.createUser({ ...user, passwordHash: await hashPassword(body.password) }, actor.id);
      send(response, 201, { user: created });
    } catch (error) {
      send(response, error.code === '23505' ? 409 : 503, { message: error.code === '23505' ? 'Username already exists' : 'User could not be created' });
    }
    return;
  }
  const userUpdate = /^\/api\/v1\/admin\/users\/(\d+)$/.exec(request.url);
  if (request.method === 'PATCH' && userUpdate) {
    if (!trustedOrigin(request)) return send(response, 403, { message: 'Untrusted origin' });
    const actor = await auth.authenticate(request);
    if (!actor) return send(response, 401, { message: 'Authentication required' });
    if (!hasPermission(auth.userPayload(actor), 'users:manage')) return send(response, 403, { message: 'Forbidden' });
    if (String(actor.id) === userUpdate[1]) return send(response, 409, { message: 'Admin cannot modify their own account through this endpoint' });
    const body = await readJsonBody(request, response);
    if (!body) return;
    const normalized = normalizeUserInput(body, new Set(config.sources.map((source) => source.id)));
    if (!normalized || typeof body.isActive !== 'boolean') return send(response, 400, { message: 'Invalid user fields' });
    try {
      const updated = await store.updateUser(userUpdate[1], { ...normalized, isActive: body.isActive }, actor.id);
      send(response, updated ? 200 : 404, updated ? { user: updated } : { message: 'User not found' });
    } catch {
      send(response, 503, { message: 'User could not be updated' });
    }
    return;
  }
  const passwordReset = /^\/api\/v1\/admin\/users\/(\d+)\/password$/.exec(request.url);
  if (request.method === 'POST' && passwordReset) {
    if (!trustedOrigin(request)) return send(response, 403, { message: 'Untrusted origin' });
    const actor = await auth.authenticate(request);
    if (!actor) return send(response, 401, { message: 'Authentication required' });
    if (!hasPermission(auth.userPayload(actor), 'users:manage')) return send(response, 403, { message: 'Forbidden' });
    if (String(actor.id) === passwordReset[1]) return send(response, 409, { message: 'Use the self-service password endpoint for your own account' });
    const body = await readJsonBody(request, response);
    if (!body) return;
    if (!validPassword(body.password)) return send(response, 400, { message: 'Password must be between 12 and 128 characters' });
    try {
      const changed = await store.updatePassword(passwordReset[1], await hashPassword(body.password), actor.id);
      send(response, changed ? 200 : 404, changed ? { passwordReset: true } : { message: 'User not found' });
    } catch { send(response, 503, { message: 'Password reset failed' }); }
    return;
  }
  if (request.method === 'GET' && request.url === '/api/v1/admin/audit-log') {
    const user = await auth.authenticate(request);
    if (!user) return send(response, 401, { message: 'Authentication required' });
    if (!hasPermission(auth.userPayload(user), 'users:manage')) return send(response, 403, { message: 'Forbidden' });
    try { send(response, 200, { entries: await store.getAuditLog() }); }
    catch { send(response, 503, { message: 'Audit log is unavailable' }); }
    return;
  }
  send(response, 404, { message: 'Not found' });
}

const sockets = new WebSocketServer({ noServer: true });
server.on('upgrade', (request, socket, head) => {
  if (request.url !== '/ws' || request.headers.origin !== config.webOrigin) {
    socket.destroy();
    return;
  }
  sockets.handleUpgrade(request, socket, head, (client) => {
    sockets.emit('connection', client);
  });
});
sockets.on('connection', (client) => {
  client.send(JSON.stringify(monitor.snapshot()));
});
monitor.subscribe((snapshot) => {
  const message = JSON.stringify(snapshot);
  for (const client of sockets.clients) {
    if (client.readyState === client.OPEN) client.send(message);
  }
});

server.listen(config.port, config.host, () => {
  console.log(`Monitoring Kadis dev API: http://${config.host}:${config.port}`);
  monitor.start();
});

async function shutdown() {
  monitor.stop();
  server.close(async () => {
    if (oracleSource) await oracleSource.close();
    await store.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
