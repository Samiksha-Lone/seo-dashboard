import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function redactDiagnosticString(value) {
  return value
    .replace(/\b(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis|rediss|amqp|mssql|prisma(?:\+postgres)?):\/\/[^\s"'<>]+/gi, '[REDACTED_CONNECTION_STRING]')
    .replace(
      /(\b(?:password|passwd|pwd|user(?:name)?|token|access[_-]?token|refresh[_-]?token|secret|api[_-]?key|client[_-]?secret|authorization)\b\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^&\s"'<>;,]+)/gi,
      '$1[REDACTED]'
    )
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED_TOKEN]');
}

function redactDiagnosticValue(value, key, seen = new WeakSet()) {
  if (key && /password|passwd|pwd|token|secret|credential|api[_-]?key|authorization|user(?:name)?|connection(?:[_-]?(?:string|url))?/i.test(key)) {
    return '[REDACTED]';
  }
  if (typeof value === 'string') return redactDiagnosticString(value);
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactDiagnosticValue(item, undefined, seen));
  }
  return Object.fromEntries(
    Object.entries(value).map(([entryKey, entryValue]) => [
      entryKey,
      redactDiagnosticValue(entryValue, entryKey, seen),
    ])
  );
}

function getLoginErrorDiagnostics(error, seen = new WeakSet()) {
  if (!error || typeof error !== 'object') {
    return { message: redactDiagnosticValue(error) };
  }
  if (seen.has(error)) return '[Circular]';
  seen.add(error);

  const diagnostics = {};
  for (const key of ['name', 'code', 'message', 'clientVersion']) {
    if (error[key] !== undefined && error[key] !== null) {
      diagnostics[key] = redactDiagnosticValue(error[key], key);
    }
  }
  if (error.meta !== undefined && error.meta !== null) {
    diagnostics.meta = redactDiagnosticValue(error.meta, 'meta');
  }
  if (error.cause !== undefined && error.cause !== null) {
    diagnostics.cause = getLoginErrorDiagnostics(error.cause, seen);
  }
  return diagnostics;
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some((key) => !['email', 'password'].includes(key))) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
  }

  const { authenticateUser, isSameOriginRequest, sessionCookieOptions, validateEmail } =
    require('../../../../services/auth');
  const {
    clearLoginAttempts,
    getClientAddress,
    getLoginRateLimitRedis,
    getLoginRateLimitSettings,
    reserveLoginAttempt,
  } = require('../../../../services/login-rate-limit');
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Cross-origin request rejected.' }, { status: 403 });
  }
  const email = validateEmail(body.email);
  if (!email || typeof body.password !== 'string' || !body.password) {
    return NextResponse.json({ error: 'Enter a valid email and password.' }, { status: 400 });
  }

  let rateLimitRedis;
  let attempt;
  try {
    const settings = getLoginRateLimitSettings();
    const clientAddress = getClientAddress(request);
    rateLimitRedis = getLoginRateLimitRedis();
    attempt = await reserveLoginAttempt(rateLimitRedis, email, clientAddress, settings);
  } catch (error) {
    console.error('Login rate limiter unavailable:', {
      name: error && error.name ? error.name : 'Error',
      code: error && error.code ? error.code : 'UNKNOWN',
    });
    return NextResponse.json(
      { error: 'Sign-in is temporarily unavailable. Please try again later.' },
      { status: 503 }
    );
  }
  if (!attempt.allowed) {
    return NextResponse.json(
      { error: 'Too many sign-in attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(attempt.retryAfter) } }
    );
  }

  try {
    const result = await authenticateUser(prisma, email, body.password);
    if (!result) {
      return NextResponse.json({ error: 'Email or password is incorrect.' }, { status: 401 });
    }

    try {
      await clearLoginAttempts(rateLimitRedis, attempt.key);
    } catch (error) {
      try {
        await prisma.session.deleteMany({
          where: { tokenHash: result.session.tokenHash },
        });
      } catch (cleanupError) {
        console.error('Login session cleanup after rate limiter failure failed:', {
          name: cleanupError && cleanupError.name ? cleanupError.name : 'Error',
          code: cleanupError && cleanupError.code ? cleanupError.code : 'UNKNOWN',
        });
      }
      console.error('Login rate limit reset failed:', {
        name: error && error.name ? error.name : 'Error',
        code: error && error.code ? error.code : 'UNKNOWN',
      });
      return NextResponse.json(
        { error: 'Sign-in is temporarily unavailable. Please try again later.' },
        { status: 503 }
      );
    }

    const response = NextResponse.json({
      data: {
        user: result.session.user,
        mustChangePassword: result.session.user.mustChangePassword,
      },
    });
    response.cookies.set('edgelink_session', result.token, sessionCookieOptions());
    return response;
  } catch (error) {
    console.error('Login failed:', getLoginErrorDiagnostics(error));
    return NextResponse.json({ error: 'Unable to sign in right now.' }, { status: 500 });
  }
}
