import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(request) {
  const { SESSION_COOKIE_NAME, clearSessionCookieOptions, invalidateSession, isSameOriginRequest } =
    require('../../../../services/auth');
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Cross-origin request rejected.' }, { status: 403 });
  }
  try {
    await invalidateSession(prisma, request);
  } catch (error) {
    console.error('Logout session invalidation failed:', {
      name: error && error.name ? error.name : 'Error',
      code: error && error.code ? error.code : 'UNKNOWN',
    });
    return NextResponse.json({ error: 'Unable to sign out right now.' }, { status: 500 });
  }
  const response = NextResponse.json({ data: { loggedOut: true } });
  response.cookies.set(SESSION_COOKIE_NAME, '', clearSessionCookieOptions());
  return response;
}
