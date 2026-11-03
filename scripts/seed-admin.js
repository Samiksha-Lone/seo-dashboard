const { PrismaClient } = require('../src/generated/prisma/client.ts');
const { hashPassword, validateEmail, validatePassword } = require('../src/services/auth');

async function main() {
  const email = validateEmail(process.env.INITIAL_ADMIN_EMAIL);
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  const name = (process.env.INITIAL_ADMIN_NAME || 'Administrator').trim();

  if (!email || !password || !name) {
    throw new Error('Set INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_PASSWORD, and optionally INITIAL_ADMIN_NAME in .env.');
  }
  const passwordError = validatePassword(password);
  if (passwordError) throw new Error(passwordError);

  const prisma = new PrismaClient();
  try {
    const existingAdmin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true },
    });
    if (existingAdmin) {
      console.info('An administrator already exists; no account was created.');
      return;
    }

    const existingEmail = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existingEmail) {
      throw new Error('The configured administrator email is already assigned to another account.');
    }

    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await hashPassword(password),
        role: 'ADMIN',
        isActive: true,
        mustChangePassword: false,
      },
      select: { id: true },
    });
    console.info('Initial administrator account created.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Administrator setup failed:', error.message);
  process.exitCode = 1;
});
