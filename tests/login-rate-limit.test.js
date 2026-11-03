const test = require('node:test');
const assert = require('node:assert/strict');
const {
  clearLoginAttempts,
  createLoginRateLimitKey,
  getClientAddress,
  getLoginRateLimitSettings,
  reserveLoginAttempt,
} = require('../src/services/login-rate-limit');

function createRedis(now = () => Date.now()) {
  const entries = new Map();
  return {
    entries,
    async eval(_script, keyCount, key, maxAttempts, windowSeconds) {
      assert.equal(keyCount, 1);
      let entry = entries.get(key);
      if (entry && entry.expiresAt <= now()) {
        entries.delete(key);
        entry = null;
      }
      if (entry && entry.count >= Number(maxAttempts)) {
        return [0, Math.max(1, Math.ceil((entry.expiresAt - now()) / 1000))];
      }
      if (!entry) {
        entry = {
          count: 0,
          expiresAt: now() + Number(windowSeconds) * 1000,
        };
        entries.set(key, entry);
      }
      entry.count += 1;
      return [1, Math.max(1, Math.ceil((entry.expiresAt - now()) / 1000))];
    },
    async del(key) {
      return entries.delete(key) ? 1 : 0;
    },
  };
}

test('login limiter reserves a bounded number of attempts and reports the expiry', async () => {
  const redis = createRedis();
  const settings = { maxAttempts: 2, windowSeconds: 120 };
  assert.equal((await reserveLoginAttempt(redis, 'Admin@Example.test', '203.0.113.10', settings)).allowed, true);
  assert.equal((await reserveLoginAttempt(redis, 'admin@example.test', '203.0.113.10', settings)).allowed, true);
  const blocked = await reserveLoginAttempt(redis, 'admin@example.test', '203.0.113.10', settings);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfter, 120);
});

test('concurrent login attempts use the atomic limit', async () => {
  const redis = createRedis();
  const settings = { maxAttempts: 1, windowSeconds: 60 };
  const results = await Promise.all([
    reserveLoginAttempt(redis, 'admin@example.test', '203.0.113.10', settings),
    reserveLoginAttempt(redis, 'admin@example.test', '203.0.113.10', settings),
  ]);
  assert.equal(results.filter(({ allowed }) => allowed).length, 1);
  assert.equal(results.filter(({ allowed }) => !allowed).length, 1);
});

test('successful login reset clears the counter and expired buckets become available', async () => {
  let time = 0;
  const redis = createRedis(() => time);
  const settings = { maxAttempts: 1, windowSeconds: 60 };
  const first = await reserveLoginAttempt(redis, 'admin@example.test', '192.0.2.1', settings);
  assert.equal((await reserveLoginAttempt(redis, 'admin@example.test', '192.0.2.1', settings)).allowed, false);
  await clearLoginAttempts(redis, first.key);
  assert.equal((await reserveLoginAttempt(redis, 'admin@example.test', '192.0.2.1', settings)).allowed, true);
  await reserveLoginAttempt(redis, 'admin@example.test', '192.0.2.1', settings);
  time = 60_001;
  assert.equal((await reserveLoginAttempt(redis, 'admin@example.test', '192.0.2.1', settings)).allowed, true);
});

test('client address trusts only the configured proxy header or request IP', () => {
  const request = new Request('https://dashboard.example.test/login', {
    headers: { 'x-forwarded-for': '198.51.100.55' },
  });
  assert.equal(getClientAddress(request, { trustedProxyIpHeader: null }), 'unknown');
  assert.equal(
    getClientAddress(request, { trustedProxyIpHeader: 'x-real-ip' }),
    'unknown'
  );
  const proxiedRequest = new Request('https://dashboard.example.test/login', {
    headers: { 'x-real-ip': '2001:db8::1', 'x-forwarded-for': '198.51.100.55' },
  });
  assert.equal(
    getClientAddress(proxiedRequest, { trustedProxyIpHeader: 'x-real-ip' }),
    '2001:db8::1'
  );
  assert.notEqual(
    createLoginRateLimitKey('Admin@example.test', '192.0.2.1'),
    createLoginRateLimitKey('Admin@example.test', '192.0.2.2')
  );
});

test('login limiter configuration rejects invalid limits', () => {
  assert.deepEqual(getLoginRateLimitSettings({}), {
    maxAttempts: 5,
    windowSeconds: 900,
  });
  assert.throws(
    () => getLoginRateLimitSettings({ LOGIN_RATE_LIMIT_MAX_ATTEMPTS: '0' }),
    /LOGIN_RATE_LIMIT_MAX_ATTEMPTS/
  );
  assert.throws(
    () => getLoginRateLimitSettings({ LOGIN_RATE_LIMIT_WINDOW_SECONDS: 'nope' }),
    /LOGIN_RATE_LIMIT_WINDOW_SECONDS/
  );
});

test('Redis errors propagate so login can fail closed', async () => {
  const redis = {
    async eval() {
      throw new Error('Redis unavailable');
    },
  };
  await assert.rejects(
    reserveLoginAttempt(redis, 'admin@example.test', 'unknown', {
      maxAttempts: 5,
      windowSeconds: 900,
    }),
    /Redis unavailable/
  );
});
