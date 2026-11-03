const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SESSION_COOKIE_NAME,
  authenticateUser,
  authorizeApi,
  getAuthSession,
  hashPassword,
  hashSessionToken,
  invalidateOtherSessions,
  invalidateSession,
  validateEmail,
  validatePassword,
  verifyPassword,
} = require('../src/services/auth');

test('passwords are stored as verifiable salted scrypt hashes', async () => {
  const hash = await hashPassword('correct horse battery staple');
  assert.match(hash, /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
  assert.equal(await verifyPassword('correct horse battery staple', hash), true);
  assert.equal(await verifyPassword('incorrect password', hash), false);
  assert.notEqual(await hashPassword('correct horse battery staple'), hash);
  assert.equal(hash.includes('correct horse'), false);
});

test('email and password validation normalize emails and enforce password bounds', () => {
  assert.equal(validateEmail(' Admin@Example.COM '), 'admin@example.com');
  assert.equal(validateEmail('not-an-email'), null);
  assert.equal(validatePassword('short'), 'Password must be at least 12 characters.');
  assert.equal(validatePassword('correct horse battery staple'), null);
});

test('login creates a random cookie token while persisting only its hash', async () => {
  const passwordHash = await hashPassword('client secure password');
  let created;
  const prisma = {
    user: {
      async findUnique({ where }) {
        assert.deepEqual(where, { email: 'client@example.com' });
        return {
          id: 'user_client',
          name: 'Client',
          email: 'client@example.com',
          role: 'CLIENT',
          passwordHash,
          isActive: true,
          mustChangePassword: true,
          client: { id: 'client_1' },
        };
      },
    },
    session: {
      async create({ data }) {
        created = data;
        return { id: 'session_1', expiresAt: data.expiresAt };
      },
    },
  };
  const result = await authenticateUser(prisma, 'Client@Example.com', 'client secure password');
  assert.equal(result.session.user.mustChangePassword, true);
  assert.equal(result.session.user.clientId, 'client_1');
  assert.match(result.token, /^[a-f0-9]{64}$/);
  assert.equal(created.tokenHash, hashSessionToken(result.token));
  assert.notEqual(created.tokenHash, result.token);
  assert.equal(created.userId, 'user_client');
});

test('invalid, inactive, or unlinked client credentials do not authenticate', async () => {
  const passwordHash = await hashPassword('client secure password');
  for (const user of [
    { isActive: false, role: 'ADMIN', client: null },
    { isActive: true, role: 'CLIENT', client: null },
  ]) {
    const result = await authenticateUser({
      user: { async findUnique() { return { ...user, passwordHash, id: 'user_1', name: 'User', email: 'user@example.com', mustChangePassword: false }; } },
      session: { async create() { assert.fail('Invalid user must not create a session.'); } },
    }, 'user@example.com', 'client secure password');
    assert.equal(result, null);
  }
  const invalidPassword = await authenticateUser({
    user: { async findUnique() { return { id: 'user_1', name: 'User', email: 'user@example.com', role: 'ADMIN', isActive: true, mustChangePassword: false, passwordHash, client: null }; } },
    session: { async create() { assert.fail('Invalid credentials must not create a session.'); } },
  }, 'user@example.com', 'wrong password');
  assert.equal(invalidPassword, null);
});

test('session validation rejects expired and inactive-user sessions and removes them', async () => {
  const now = new Date('2026-11-03T00:00:00.000Z');
  const token = 'a'.repeat(64);
  let deleted = 0;
  const session = {
    id: 'session_1',
    tokenHash: hashSessionToken(token),
    expiresAt: new Date('2026-11-02T00:00:00.000Z'),
    user: {
      id: 'user_1',
      name: 'User',
      email: 'user@example.com',
      role: 'ADMIN',
      isActive: true,
      mustChangePassword: false,
      client: null,
    },
  };
  const prisma = {
    session: {
      async findUnique(args) {
        assert.equal(args.where.tokenHash, hashSessionToken(token));
        return session;
      },
      async deleteMany(args) {
        assert.equal(args.where.tokenHash, hashSessionToken(token));
        deleted += 1;
      },
    },
  };
  const result = await getAuthSession(
    new Request('http://localhost', { headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` } }),
    prisma,
    { now }
  );
  assert.equal(result, null);
  assert.equal(deleted, 1);
});

test('session validation rejects an unexpired session for an inactive user and removes it', async () => {
  const token = 'd'.repeat(64);
  let deleted = 0;
  const result = await getAuthSession(
    new Request('http://localhost', {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
    }),
    {
      session: {
        async findUnique() {
          return {
            id: 'session_inactive',
            tokenHash: hashSessionToken(token),
            expiresAt: new Date(Date.now() + 60_000),
            user: {
              id: 'user_inactive',
              name: 'Inactive',
              email: 'inactive@example.test',
              role: 'ADMIN',
              isActive: false,
              mustChangePassword: false,
              client: null,
            },
          };
        },
        async deleteMany({ where }) {
          assert.equal(where.tokenHash, hashSessionToken(token));
          deleted += 1;
        },
      },
    }
  );
  assert.equal(result, null);
  assert.equal(deleted, 1);
});

test('logout invalidates the database session using only the cookie token hash', async () => {
  const token = 'c'.repeat(64);
  let where;
  const result = await invalidateSession({
    session: {
      async deleteMany(args) {
        where = args.where;
        return { count: 1 };
      },
    },
  }, new Request('http://localhost', {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
  }));
  assert.equal(result, true);
  assert.deepEqual(where, { tokenHash: hashSessionToken(token) });
  assert.notEqual(where.tokenHash, token);
});

test('password change invalidates other sessions but preserves the current session', async () => {
  const currentToken = 'e'.repeat(64);
  let where;
  const result = await invalidateOtherSessions({
    session: {
      deleteMany(args) {
        where = args.where;
        return Promise.resolve({ count: 2 });
      },
    },
  }, 'user_1', currentToken);
  assert.equal(result.count, 2);
  assert.deepEqual(where, {
    userId: 'user_1',
    tokenHash: { not: hashSessionToken(currentToken) },
  });
  assert.throws(
    () => invalidateOtherSessions({ session: { deleteMany() {} } }, 'user_1', 'invalid'),
    /valid current session token/
  );
});

test('authorization enforces login, role boundaries, and forced password changes', async () => {
  const request = new Request('http://localhost/api/private');
  const unauthorized = await authorizeApi(request, { session: { async findUnique() { return null; } } });
  assert.equal(unauthorized.response.status, 401);

  const token = 'b'.repeat(64);
  function prismaFor(user) {
    return {
      session: {
        async findUnique() {
          return {
            id: 'session_1',
            tokenHash: hashSessionToken(token),
            expiresAt: new Date(Date.now() + 60_000),
            user: { ...user, isActive: true },
          };
        },
        async deleteMany() {},
      },
    };
  }
  const clientRequest = new Request('http://localhost/api/private', {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
  });
  const clientDenied = await authorizeApi(clientRequest, prismaFor({
    id: 'client_user',
    name: 'Client',
    email: 'client@example.com',
    role: 'CLIENT',
    mustChangePassword: false,
    client: { id: 'client_a' },
  }), { roles: ['ADMIN'] });
  assert.equal(clientDenied.response.status, 403);

  const forcedChange = await authorizeApi(clientRequest, prismaFor({
    id: 'client_user',
    name: 'Client',
    email: 'client@example.com',
    role: 'CLIENT',
    mustChangePassword: true,
    client: { id: 'client_a' },
  }), { roles: ['CLIENT'] });
  assert.equal(forcedChange.response.status, 403);
  const allowedChange = await authorizeApi(clientRequest, prismaFor({
    id: 'client_user',
    name: 'Client',
    email: 'client@example.com',
    role: 'CLIENT',
    mustChangePassword: true,
    client: { id: 'client_a' },
  }), { roles: ['CLIENT'], allowPasswordChange: true });
  assert.equal(allowedChange.session.user.mustChangePassword, true);
});
