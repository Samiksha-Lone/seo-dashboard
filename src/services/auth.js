const {
  createHash,
  randomBytes,
  scrypt: scryptCallback,
  timingSafeEqual,
} = require('node:crypto');
const { promisify } = require('node:util');

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE_NAME = 'edgelink_session';
const SESSION_DURATION_SECONDS = 60 * 60 * 8;
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_BYTES = 1024;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hashSessionToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function readCookie(request, name = SESSION_COOKIE_NAME) {
  const cookieHeader = request && request.headers && request.headers.get
    ? request.headers.get('cookie')
    : '';
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

async function invalidateSession(prisma, request) {
  const token = readCookie(request);
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) return false;
  const result = await prisma.session.deleteMany({
    where: { tokenHash: hashSessionToken(token) },
  });
  return result.count > 0;
}

function invalidateOtherSessions(prisma, userId, currentToken) {
  if (typeof currentToken !== 'string' || !/^[a-f0-9]{64}$/i.test(currentToken)) {
    throw new TypeError('A valid current session token is required.');
  }
  return prisma.session.deleteMany({
    where: {
      userId,
      tokenHash: { not: hashSessionToken(currentToken) },
    },
  });
}

function validateEmail(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && EMAIL_PATTERN.test(email) ? email : null;
}

function validatePassword(value, { temporary = false } = {}) {
  if (typeof value !== 'string') return 'Password is required.';
  const bytes = Buffer.byteLength(value, 'utf8');
  if (bytes > PASSWORD_MAX_BYTES) return 'Password must be 1024 bytes or fewer.';
  if (value.length < PASSWORD_MIN_LENGTH) {
    return temporary
      ? 'Temporary password must be at least 12 characters.'
      : 'Password must be at least 12 characters.';
  }
  return null;
}

async function hashPassword(password) {
  const error = validatePassword(password);
  if (error) throw new TypeError(error);
  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
}

async function verifyPassword(password, passwordHash) {
  if (typeof password !== 'string' || typeof passwordHash !== 'string') return false;
  const [algorithm, saltHex, keyHex, extra] = passwordHash.split('$');
  if (algorithm !== 'scrypt' || !saltHex || !keyHex || extra !== undefined) return false;
  if (!/^[a-f0-9]{32}$/i.test(saltHex) || !/^[a-f0-9]{128}$/i.test(keyHex)) return false;
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), 64, {
    N: 16384,
    r: 8,
    p: 1,
  });
  return timingSafeEqual(actual, Buffer.from(keyHex, 'hex'));
}

async function getAuthSession(request, prisma, { now = new Date() } = {}) {
  const token = readCookie(request);
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) return null;
  const tokenHash = hashSessionToken(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      tokenHash: true,
      expiresAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          mustChangePassword: true,
          client: { select: { id: true } },
        },
      },
    },
  });

  if (!session) return null;
  if (
    session.expiresAt <= now ||
    !session.user.isActive ||
    (session.user.role === 'CLIENT' && !session.user.client)
  ) {
    await prisma.session.deleteMany({ where: { tokenHash } });
    return null;
  }

  return {
    id: session.id,
    tokenHash: session.tokenHash,
    expiresAt: session.expiresAt,
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role: session.user.role,
      mustChangePassword: session.user.mustChangePassword,
      clientId: session.user.client ? session.user.client.id : null,
    },
  };
}

async function authenticateUser(prisma, emailInput, password, { now = new Date() } = {}) {
  const email = validateEmail(emailInput);
  if (!email || typeof password !== 'string' || Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) {
    return null;
  }
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      passwordHash: true,
      isActive: true,
      mustChangePassword: true,
      client: { select: { id: true } },
    },
  });
  if (!user || !user.isActive || (user.role === 'CLIENT' && !user.client)) return null;
  if (!(await verifyPassword(password, user.passwordHash))) return null;

  const token = randomBytes(32).toString('hex');
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_SECONDS * 1000);
  const session = await prisma.session.create({
    data: { tokenHash, userId: user.id, expiresAt },
    select: { id: true, expiresAt: true },
  });
  return {
    token,
    session: {
      id: session.id,
      tokenHash,
      expiresAt: session.expiresAt,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
        clientId: user.client ? user.client.id : null,
      },
    },
  };
}

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION_SECONDS,
  };
}

function clearSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  };
}

function isSameOriginRequest(request) {
  const origin = request && request.headers && request.headers.get
    ? request.headers.get('origin')
    : null;
  const fetchSite = request && request.headers && request.headers.get
    ? request.headers.get('sec-fetch-site')
    : null;
  if (fetchSite === 'cross-site') return false;
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function authorizeApi(request, prisma, { roles, allowPasswordChange = false } = {}) {
  if (!isSameOriginRequest(request)) {
    return {
      session: null,
      response: Response.json({ error: 'Cross-origin request rejected.' }, { status: 403 }),
    };
  }

  let session;
  try {
    session = await getAuthSession(request, prisma);
  } catch (error) {
    console.error('Session validation failed:', {
      name: error && error.name ? error.name : 'Error',
      code: error && error.code ? error.code : 'UNKNOWN',
    });
    return {
      session: null,
      response: Response.json({ error: 'Authentication is temporarily unavailable.' }, { status: 500 }),
    };
  }

  if (!session) {
    return { session: null, response: Response.json({ error: 'Authentication required.' }, { status: 401 }) };
  }
  if (session.user.mustChangePassword && !allowPasswordChange) {
    return { session: null, response: Response.json({ error: 'Change your temporary password to continue.' }, { status: 403 }) };
  }
  if (roles && !roles.includes(session.user.role)) {
    return { session: null, response: Response.json({ error: 'You do not have permission to access this resource.' }, { status: 403 }) };
  }
  return { session, response: null };
}

async function requirePageRole(roles) {
  const { cookies } = require('next/headers');
  const { redirect } = require('next/navigation');
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const request = new Request('http://localhost', {
    headers: token ? { cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}` } : {},
  });
  let session = null;
  try {
    const { prisma } = await import('../lib/prisma.js');
    session = await getAuthSession(request, prisma);
  } catch (error) {
    console.error('Page session validation failed:', {
      name: error && error.name ? error.name : 'Error',
      code: error && error.code ? error.code : 'UNKNOWN',
    });
    redirect('/login?error=unavailable');
  }
  if (!session) redirect('/login');
  if (session.user.mustChangePassword) redirect('/change-password');
  if (!roles.includes(session.user.role)) {
    redirect(session.user.role === 'CLIENT' ? '/portal' : '/');
  }
  return session;
}

async function requirePortalPage() {
  const session = await requirePageRole(['CLIENT']);
  return session;
}

module.exports = {
  EMAIL_PATTERN,
  PASSWORD_MIN_LENGTH,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
  authenticateUser,
  authorizeApi,
  clearSessionCookieOptions,
  getAuthSession,
  hashPassword,
  hashSessionToken,
  invalidateOtherSessions,
  invalidateSession,
  isSameOriginRequest,
  readCookie,
  requirePageRole,
  requirePortalPage,
  sessionCookieOptions,
  validateEmail,
  validatePassword,
  verifyPassword,
};
