import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { scrypt as scryptCallback } from 'node:crypto';

const scrypt = promisify(scryptCallback);
const PASSWORD_BYTES = 64;
const SESSION_COOKIE = 'mk_session';
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
export const ROLE_PERMISSIONS = Object.freeze({
  kadis: ['dashboard:read', 'history:read'],
  admin: ['dashboard:read', 'history:read', 'users:manage', 'events:read', 'sources:inspect'],
  petugas: ['dashboard:read', 'history:read', 'assigned-sources:inspect'],
});

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, PASSWORD_BYTES);
  return `scrypt$v1$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export async function verifyPassword(password, storedHash) {
  const [, version, saltHex, expectedHex] = String(storedHash || '').split('$');
  if (version !== 'v1' || !/^[a-f0-9]{32}$/.test(saltHex || '') || !/^[a-f0-9]{128}$/.test(expectedHex || '')) {
    await scrypt(password, Buffer.alloc(16), PASSWORD_BYTES);
    return false;
  }
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), PASSWORD_BYTES);
  return timingSafeEqual(actual, expected);
}

function parseCookie(header, name) {
  for (const part of String(header || '').split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) {
      try { return decodeURIComponent(part.slice(separator + 1).trim()); } catch { return null; }
    }
  }
  return null;
}

function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function createAuth(store, { cookieSecure = false } = {}) {
  function cookie(token, maxAgeSeconds) {
    return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${cookieSecure ? '; Secure' : ''}`;
  }

  return {
    cookieName: SESSION_COOKIE,
    clearCookie: cookie('', 0),
    setCookie: (token) => cookie(token, Math.floor(SESSION_TTL_MS / 1000)),
    async login(username, password) {
      const user = await store.findUserByUsername(username);
      const valid = await verifyPassword(password, user?.passwordHash);
      if (!user || !valid || !user.isActive) return null;
      const token = randomBytes(32).toString('base64url');
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
      await store.createSession(tokenHash(token), user.id, expiresAt);
      return {
        token,
        expiresAt: expiresAt.toISOString(),
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
          assignedSources: user.assignedSources,
        },
      };
    },
    async authenticate(request) {
      const token = parseCookie(request.headers.cookie, SESSION_COOKIE);
      if (!token || !/^[A-Za-z0-9_-]{40,50}$/.test(token)) return null;
      return store.getSessionUser(tokenHash(token));
    },
    userPayload(user) {
      return {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        assignedSources: user.assignedSources || [],
        permissions: ROLE_PERMISSIONS[user.role] || [],
      };
    },
    async logout(request) {
      const token = parseCookie(request.headers.cookie, SESSION_COOKIE);
      if (token && /^[A-Za-z0-9_-]{40,50}$/.test(token)) await store.deleteSession(tokenHash(token));
    },
  };
}
