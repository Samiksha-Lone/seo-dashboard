const {
  hashPassword,
  validateEmail,
  validatePassword,
} = require('./auth');

async function updateClientAccount(prisma, clientId, input) {
  if (input.action === 'provision' || input.action === 'resetPassword') {
    const email = input.email === undefined ? undefined : validateEmail(input.email);
    if (input.email !== undefined && !email) {
      return { status: 400, body: { error: 'Enter a valid client account email.' } };
    }
    const passwordError = validatePassword(input.temporaryPassword, { temporary: true });
    if (passwordError) return { status: 400, body: { error: passwordError } };
    const passwordHash = await hashPassword(input.temporaryPassword);
    const result = await prisma.$transaction(async (transaction) => {
      const client = await transaction.client.findUnique({
        where: { id: clientId },
        select: { id: true, businessName: true, user: { select: { id: true } } },
      });
      if (!client) return { status: 404, body: { error: 'Client not found.' } };
      if (input.action === 'provision' && client.user) {
        return { status: 409, body: { error: 'This client already has a login account.' } };
      }
      if (input.action === 'resetPassword' && !client.user) {
        return { status: 409, body: { error: 'Provision a client account before resetting its password.' } };
      }

      const account = input.action === 'provision'
        ? await transaction.user.create({
            data: {
              name: client.businessName,
              email,
              passwordHash,
              role: 'CLIENT',
              mustChangePassword: true,
              client: { connect: { id: client.id } },
            },
            select: { id: true, email: true, isActive: true, mustChangePassword: true },
          })
        : await transaction.user.update({
            where: { id: client.user.id },
            data: {
              ...(email ? { email } : {}),
              passwordHash,
              mustChangePassword: true,
            },
            select: { id: true, email: true, isActive: true, mustChangePassword: true },
          });
      await transaction.session.deleteMany({ where: { userId: account.id } });
      return { status: input.action === 'provision' ? 201 : 200, body: { data: account } };
    });
    return result;
  }

  const email = input.email === undefined ? undefined : validateEmail(input.email);
  if (input.email !== undefined && !email) {
    return { status: 400, body: { error: 'Enter a valid client account email.' } };
  }
  if (input.isActive !== undefined && typeof input.isActive !== 'boolean') {
    return { status: 400, body: { error: 'isActive must be a boolean.' } };
  }

  return prisma.$transaction(async (transaction) => {
    const client = await transaction.client.findUnique({
      where: { id: clientId },
      select: { id: true, userId: true },
    });
    if (!client) return { status: 404, body: { error: 'Client not found.' } };
    if (!client.userId) return { status: 409, body: { error: 'This client has no login account.' } };
    const account = await transaction.user.update({
      where: { id: client.userId },
      data: {
        ...(email ? { email } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      select: { id: true, email: true, isActive: true, mustChangePassword: true },
    });
    if (input.isActive === false) {
      await transaction.session.deleteMany({ where: { userId: client.userId } });
    }
    return { status: 200, body: { data: account } };
  });
}

module.exports = { updateClientAccount };
