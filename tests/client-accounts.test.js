const test = require('node:test');
const assert = require('node:assert/strict');
const { updateClientAccount } = require('../src/services/client-accounts');
const { verifyPassword } = require('../src/services/auth');

function fakePrisma({ user = null } = {}) {
  const state = {
    user,
    sessionDeletes: [],
    userCreates: [],
    userUpdates: [],
  };
  const transaction = {
    client: {
      async findUnique() {
        return {
          id: 'client_1',
          userId: state.user?.id || null,
          businessName: 'Example Client',
          user: state.user && { id: state.user.id },
        };
      },
    },
    user: {
      async create({ data }) {
        state.userCreates.push(data);
        state.user = {
          id: 'user_1',
          email: data.email,
          isActive: true,
          mustChangePassword: data.mustChangePassword,
          passwordHash: data.passwordHash,
        };
        return {
          id: state.user.id,
          email: state.user.email,
          isActive: state.user.isActive,
          mustChangePassword: state.user.mustChangePassword,
        };
      },
      async update({ where, data }) {
        state.userUpdates.push({ where, data });
        state.user = { ...state.user, ...data };
        return {
          id: state.user.id,
          email: state.user.email,
          isActive: state.user.isActive,
          mustChangePassword: state.user.mustChangePassword,
        };
      },
    },
    session: {
      async deleteMany({ where }) { state.sessionDeletes.push(where); },
    },
  };
  return {
    state,
    async $transaction(callback) { return callback(transaction); },
  };
}

test('admin provisioning links an active client account with a temporary password hash', async () => {
  const prisma = fakePrisma();
  const result = await updateClientAccount(prisma, 'client_1', {
    action: 'provision',
    email: 'Portal@Example.com',
    temporaryPassword: 'temporary client password',
  });
  assert.equal(result.status, 201);
  assert.equal(result.body.data.email, 'portal@example.com');
  assert.equal(result.body.data.isActive, true);
  assert.equal(result.body.data.mustChangePassword, true);
  assert.equal(prisma.state.userCreates[0].role, 'CLIENT');
  assert.equal(prisma.state.userCreates[0].client.connect.id, 'client_1');
  assert.equal(await verifyPassword('temporary client password', prisma.state.userCreates[0].passwordHash), true);
  assert.equal(JSON.stringify(result).includes('temporary client password'), false);
});

test('Admin password reset invalidates all existing sessions and keeps account activation unchanged', async () => {
  const prisma = fakePrisma({
    user: { id: 'user_1', email: 'client@example.com', isActive: false, mustChangePassword: false },
  });
  const result = await updateClientAccount(prisma, 'client_1', {
    action: 'resetPassword',
    temporaryPassword: 'new temporary client password',
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.data.isActive, false);
  assert.equal(result.body.data.mustChangePassword, true);
  assert.deepEqual(prisma.state.sessionDeletes, [{ userId: 'user_1' }]);
  assert.equal(await verifyPassword('new temporary client password', prisma.state.userUpdates[0].data.passwordHash), true);
});

test('deactivation invalidates sessions and activation changes only the active flag', async () => {
  const prisma = fakePrisma({
    user: { id: 'user_1', email: 'client@example.com', isActive: true, mustChangePassword: false },
  });
  const deactivated = await updateClientAccount(prisma, 'client_1', { isActive: false });
  assert.equal(deactivated.body.data.isActive, false);
  assert.deepEqual(prisma.state.sessionDeletes, [{ userId: 'user_1' }]);
  const activated = await updateClientAccount(prisma, 'client_1', { isActive: true });
  assert.equal(activated.body.data.isActive, true);
  assert.deepEqual(prisma.state.userUpdates[1].data, { isActive: true });
});

test('provisioning rejects duplicates and requires a valid temporary password', async () => {
  const existing = fakePrisma({ user: { id: 'user_1', email: 'client@example.com' } });
  const duplicate = await updateClientAccount(existing, 'client_1', {
    action: 'provision',
    email: 'client@example.com',
    temporaryPassword: 'temporary client password',
  });
  assert.equal(duplicate.status, 409);

  const invalidPassword = await updateClientAccount(fakePrisma(), 'client_1', {
    action: 'provision',
    email: 'client@example.com',
    temporaryPassword: 'short',
  });
  assert.equal(invalidPassword.status, 400);
});
