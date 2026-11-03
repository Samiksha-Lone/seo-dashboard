const { createHash } = require('node:crypto');
const { isIP } = require('node:net');
const { createRedisConnection } = require('../queues/seo-audit');

const RESERVE_SCRIPT = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
local limit = tonumber(ARGV[1])
local ttl = redis.call('TTL', KEYS[1])
if current > 0 and ttl < 0 then
  redis.call('EXPIRE', KEYS[1], ARGV[2])
  ttl = tonumber(ARGV[2])
end
if current >= limit then
  if ttl < 1 then ttl = tonumber(ARGV[2]) end
  return {0, ttl}
end
local count = redis.call('INCR', KEYS[1])
if count == 1 or ttl < 0 then redis.call('EXPIRE', KEYS[1], ARGV[2]) end
return {1, redis.call('TTL', KEYS[1])}
`;

let redisClient;

function getIntegerSetting(env, name, fallback, min, max) {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  if (!/^\d+$/.test(raw)) throw new TypeError(`${name} must be an integer between ${min} and ${max}.`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new TypeError(`${name} must be an integer between ${min} and ${max}.`);
  }
  return value;
}

function getLoginRateLimitSettings(env = process.env) {
  return {
    maxAttempts: getIntegerSetting(env, 'LOGIN_RATE_LIMIT_MAX_ATTEMPTS', 5, 1, 100),
    windowSeconds: getIntegerSetting(env, 'LOGIN_RATE_LIMIT_WINDOW_SECONDS', 900, 60, 86400),
  };
}

function validIpAddress(value) {
  if (typeof value !== 'string') return null;
  const candidate = value.trim();
  return isIP(candidate) ? candidate.toLowerCase() : null;
}

function getClientAddress(request, { trustedProxyIpHeader = process.env.TRUSTED_PROXY_IP_HEADER } = {}) {
  if (trustedProxyIpHeader) {
    if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(trustedProxyIpHeader)) {
      throw new TypeError('TRUSTED_PROXY_IP_HEADER must be a valid HTTP header name.');
    }
    return validIpAddress(request.headers.get(trustedProxyIpHeader)) || 'unknown';
  }
  return validIpAddress(request.ip) || 'unknown';
}

function createLoginRateLimitKey(email, clientAddress) {
  const identity = createHash('sha256')
    .update(`${email.trim().toLowerCase()}\n${clientAddress}`)
    .digest('hex');
  return `edgelink:login-rate-limit:v1:${identity}`;
}

async function reserveLoginAttempt(redis, email, clientAddress, settings) {
  const key = createLoginRateLimitKey(email, clientAddress);
  const result = await redis.eval(
    RESERVE_SCRIPT,
    1,
    key,
    String(settings.maxAttempts),
    String(settings.windowSeconds)
  );
  const allowed = Number(result[0]) === 1;
  return {
    key,
    allowed,
    retryAfter: allowed
      ? 0
      : Math.max(1, Number(result[1]) || settings.windowSeconds),
  };
}

async function clearLoginAttempts(redis, key) {
  await redis.del(key);
}

function getLoginRateLimitRedis() {
  if (!redisClient || redisClient.status === 'end') {
    redisClient = createRedisConnection({
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      commandTimeout: 3000,
      retryStrategy(attempt) {
        return attempt > 2 ? null : Math.min(attempt * 100, 500);
      },
    });
  }
  return redisClient;
}

module.exports = {
  clearLoginAttempts,
  createLoginRateLimitKey,
  getClientAddress,
  getLoginRateLimitRedis,
  getLoginRateLimitSettings,
  reserveLoginAttempt,
};
