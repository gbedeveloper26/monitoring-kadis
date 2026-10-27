import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuth, hashPassword, verifyPassword } from '../src/auth.js';

test('password hashing verifies correct passwords and rejects incorrect ones', async () => {
  const hash = await hashPassword('Long-enough-test-password');
  assert.notEqual(hash, 'Long-enough-test-password');
  assert.equal(await verifyPassword('Long-enough-test-password', hash), true);
  assert.equal(await verifyPassword('wrong-password', hash), false);
});

test('login stores only a token hash and session cookie is HttpOnly', async () => {
  let storedHash;
  let storedExpiry;
  const passwordHash = await hashPassword('Long-enough-test-password');
  const store = {
    findUserByUsername: async () => ({
      id: '7', username: 'admin', displayName: 'Admin', passwordHash,
      role: 'admin', assignedSources: [], isActive: true,
    }),
    createSession: async (hash, userId, expiresAt) => { storedHash = hash; storedExpiry = expiresAt; },
    getSessionUser: async () => ({ id: '7', username: 'admin', displayName: 'Admin', role: 'admin', assignedSources: [] }),
    deleteSession: async () => {},
  };
  const auth = createAuth(store, { cookieSecure: true });
  const session = await auth.login('admin', 'Long-enough-test-password');

  assert.ok(session.token);
  assert.notEqual(storedHash, session.token);
  assert.ok(storedExpiry > new Date());
  assert.match(auth.setCookie(session.token), /HttpOnly/);
  assert.match(auth.setCookie(session.token), /Secure/);
  assert.match(auth.setCookie(session.token), /SameSite=Lax/);
  assert.deepEqual((await auth.authenticate({ headers: { cookie: `${auth.cookieName}=${session.token}` } })).role, 'admin');
});

test('inactive and invalid accounts cannot log in', async () => {
  const passwordHash = await hashPassword('Long-enough-test-password');
  let sessions = 0;
  const store = {
    findUserByUsername: async () => ({
      id: '8', username: 'petugas', displayName: 'Petugas', passwordHash,
      role: 'petugas', assignedSources: ['antrian_umum'], isActive: false,
    }),
    createSession: async () => { sessions += 1; },
  };
  const auth = createAuth(store);
  assert.equal(await auth.login('petugas', 'Long-enough-test-password'), null);
  assert.equal(await auth.login('petugas', 'wrong-password'), null);
  assert.equal(sessions, 0);
});
