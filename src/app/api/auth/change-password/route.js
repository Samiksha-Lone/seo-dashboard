import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(request) {
  const { authorizeApi, hashPassword, invalidateOtherSessions, readCookie, validatePassword } =
    require('../../../../services/auth');
  const auth = await authorizeApi(request, prisma, { allowPasswordChange: true });
  if (auth.response) return auth.response;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some((key) => !['currentPassword', 'newPassword'].includes(key))) {
    return NextResponse.json({ error: 'Current and new passwords are required.' }, { status: 400 });
  }
  const validationError = validatePassword(body.newPassword);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
  if (body.currentPassword === body.newPassword) {
    return NextResponse.json({ error: 'Choose a new password different from the current password.' }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: auth.session.user.id },
      select: { passwordHash: true },
    });
    const { verifyPassword } = require('../../../../services/auth');
    if (!user || !(await verifyPassword(body.currentPassword, user.passwordHash))) {
      return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 });
    }
    const passwordHash = await hashPassword(body.newPassword);
    const token = readCookie(request);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: auth.session.user.id },
        data: { passwordHash, mustChangePassword: false },
      }),
      invalidateOtherSessions(prisma, auth.session.user.id, token),
    ]);
    return NextResponse.json({ data: { passwordChanged: true } });
  } catch (error) {
    console.error('Password change failed:', {
      name: error && error.name ? error.name : 'Error',
      code: error && error.code ? error.code : 'UNKNOWN',
    });
    return NextResponse.json({ error: 'Unable to change the password right now.' }, { status: 500 });
  }
}
