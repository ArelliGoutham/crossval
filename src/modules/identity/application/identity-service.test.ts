import { describe, expect, test } from 'vitest';
import { signUpInputSchema } from '@/modules/identity/domain/schemas';
import { IdentityService } from '@/modules/identity/application/identity-service';
import {
  FakePasswordHasher,
  FixedClock,
  InMemoryAuditLog,
  InMemorySessionRepository,
  InMemoryUserRepository,
  StubSessionTokenGenerator,
} from '@/modules/identity/application/test-doubles';

function createService() {
  const users = new InMemoryUserRepository();
  const sessions = new InMemorySessionRepository();
  const audit = new InMemoryAuditLog();
  const hasher = new FakePasswordHasher();
  const clock = new FixedClock(new Date('2026-08-08T10:00:00.000Z'));
  const tokens = new StubSessionTokenGenerator([
    'signup-token',
    'login-token',
    'logout-token',
  ]);
  const service = new IdentityService({
    users,
    sessions,
    audit,
    hasher,
    tokens,
    clock,
  });

  return {
    service,
    users,
    sessions,
    audit,
    hasher,
    clock,
  };
}

describe('IdentityService', () => {
  test('sign-up creates a merchant-owned user, session, and safe audit event', async () => {
    const { service, users, sessions, audit, hasher, clock } = createService();

    const result = await service.signUp({
      email: ' Merchant@Example.com ',
      password: 'correcthorse1',
    });

    expect(result.identity).toEqual({
      userId: expect.any(String),
      merchantId: expect.any(String),
    });
    expect(result.session).toEqual({
      token: 'signup-token',
      expiresAt: new Date('2026-08-15T10:00:00.000Z'),
    });
    expect(result.identity.userId).not.toBe(result.identity.merchantId);
    expect(hasher.hashCalls).toEqual(['correcthorse1']);
    expect(users.users).toHaveLength(1);
    expect(users.users[0]).toMatchObject({
      id: result.identity.userId,
      merchantId: result.identity.merchantId,
      email: 'merchant@example.com',
      passwordHash: 'hashed:correcthorse1',
      createdAt: clock.now(),
      updatedAt: clock.now(),
    });
    expect(sessions.sessions).toHaveLength(1);
    expect(sessions.sessions[0]).toMatchObject({
      userId: result.identity.userId,
      merchantId: result.identity.merchantId,
      expiresAt: new Date('2026-08-15T10:00:00.000Z'),
      createdAt: clock.now(),
      revokedAt: null,
    });
    expect(audit.events).toContainEqual({
      action: 'identity.sign_up.succeeded',
      occurredAt: clock.now(),
      userId: result.identity.userId,
      merchantId: result.identity.merchantId,
    });
    expect(JSON.stringify(audit.events)).not.toContain('correcthorse1');
  });

  test('sign-up rejects duplicate normalized email', async () => {
    const { service } = createService();

    await service.signUp({
      email: 'merchant@example.com',
      password: 'correcthorse1',
    });

    await expect(
      service.signUp({
        email: ' Merchant@Example.com ',
        password: 'differentpass',
      }),
    ).rejects.toMatchObject({ code: 'duplicate_email' });
  });

  test('login presents the same invalid-credentials error for missing user and wrong password', async () => {
    const { service } = createService();

    await service.signUp({
      email: 'merchant@example.com',
      password: 'correcthorse1',
    });

    await expect(
      service.login({
        email: 'none@example.com',
        password: 'correcthorse1',
      }),
    ).rejects.toMatchObject({ code: 'invalid_credentials' });
    await expect(
      service.login({
        email: 'merchant@example.com',
        password: 'wrongpassword',
      }),
    ).rejects.toMatchObject({ code: 'invalid_credentials' });
  });

  test('login creates a fresh session and audit event for valid credentials', async () => {
    const { service, sessions, audit, clock } = createService();

    await service.signUp({
      email: 'merchant@example.com',
      password: 'correcthorse1',
    });

    const result = await service.login({
      email: 'merchant@example.com',
      password: 'correcthorse1',
    });

    expect(result.identity).toEqual({
      userId: expect.any(String),
      merchantId: expect.any(String),
    });
    expect(result.session).toEqual({
      token: 'login-token',
      expiresAt: new Date('2026-08-15T10:00:00.000Z'),
    });
    expect(sessions.sessions).toHaveLength(2);
    expect(audit.events).toContainEqual({
      action: 'identity.login.succeeded',
      occurredAt: clock.now(),
      userId: result.identity.userId,
      merchantId: result.identity.merchantId,
    });
  });

  test('logout revokes the hashed session token and remains idempotent', async () => {
    const { service, sessions, audit, clock } = createService();

    await service.signUp({
      email: 'merchant@example.com',
      password: 'correcthorse1',
    });

    await service.logout('signup-token');
    await service.logout('signup-token');
    await service.logout('missing-token');

    expect(sessions.sessions[0]?.revokedAt).toEqual(clock.now());
    expect(audit.events).toContainEqual({
      action: 'identity.logout.succeeded',
      occurredAt: clock.now(),
      userId: null,
      merchantId: null,
    });
  });

  test('revoked and expired sessions cannot resolve a merchant', async () => {
    const { service, clock } = createService();

    const signedUp = await service.signUp({
      email: 'merchant@example.com',
      password: 'correcthorse1',
    });
    await service.logout('signup-token');

    await expect(service.requireMerchant('signup-token')).rejects.toMatchObject({
      code: 'unauthorized',
    });

    const loggedIn = await service.login({
      email: 'merchant@example.com',
      password: 'correcthorse1',
    });
    expect(loggedIn.identity).toEqual(signedUp.identity);

    clock.set(new Date('2026-08-16T10:00:00.000Z'));

    await expect(service.requireMerchant('login-token')).rejects.toMatchObject({
      code: 'unauthorized',
    });
  });

  test('requireMerchant returns exactly the authenticated merchant identity for an active session', async () => {
    const { service } = createService();

    const result = await service.signUp({
      email: 'merchant@example.com',
      password: 'correcthorse1',
    });

    await expect(service.requireMerchant('signup-token')).resolves.toEqual(
      result.identity,
    );
  });

  test('sign-up uses the shared schema for invalid credentials input', async () => {
    const { service } = createService();
    const invalidInput = signUpInputSchema.safeParse({
      email: 'not-an-email',
      password: 'short',
    });

    expect(invalidInput.success).toBe(false);
    await expect(
      service.signUp({
        email: 'not-an-email',
        password: 'short',
      }),
    ).rejects.toMatchObject({ name: 'ZodError' });
  });
});
