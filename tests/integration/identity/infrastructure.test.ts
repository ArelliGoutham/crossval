import { randomUUID } from 'node:crypto';

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'vitest';
import { type Db, MongoClient } from 'mongodb';

import { BcryptPasswordHasher } from '@/modules/identity/infrastructure/bcrypt-password-hasher';
import { CryptoSessionTokenGenerator } from '@/modules/identity/infrastructure/crypto-session-token-generator';
import { ensureIdentityIndexes } from '@/modules/identity/infrastructure/ensure-indexes';
import { MongoAuditLog } from '@/modules/identity/infrastructure/mongo-audit-log';
import { MongoSessionRepository } from '@/modules/identity/infrastructure/mongo-session-repository';
import { MongoUserRepository } from '@/modules/identity/infrastructure/mongo-user-repository';
import { SystemClock } from '@/modules/identity/infrastructure/system-clock';
import { resolveMongoClientOptions } from '@/shared/mongodb/client';

const mongodbUri = 'mongodb://localhost:27018/?replicaSet=rs0';
const databaseName = `crossval_task_4_${randomUUID()}`;

describe('identity infrastructure adapters', () => {
  let client: MongoClient;
  let database: Db;

  beforeAll(async () => {
    client = await MongoClient.connect(
      mongodbUri,
      resolveMongoClientOptions(mongodbUri),
    );
    database = client.db(databaseName);
  });

  beforeEach(async () => {
    await database.dropDatabase();
  });

  afterAll(async () => {
    await database.dropDatabase();
    await client.close();
  });

  test('bcrypt adapter never returns the supplied password as its hash', async () => {
    const passwordHasher = new BcryptPasswordHasher(12);

    const hash = await passwordHasher.hash('correcthorse1');

    expect(hash).not.toBe('correcthorse1');
    await expect(passwordHasher.verify('correcthorse1', hash)).resolves.toBe(
      true,
    );
    await expect(passwordHasher.verify('wrong-password', hash)).resolves.toBe(
      false,
    );
  });

  test('session token generator returns opaque unique-looking tokens', async () => {
    const sessionTokenGenerator = new CryptoSessionTokenGenerator();

    const firstToken = await sessionTokenGenerator.generate();
    const secondToken = await sessionTokenGenerator.generate();

    expect(firstToken).not.toBe(secondToken);
    expect(firstToken).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(firstToken.length).toBeGreaterThanOrEqual(43);
  });

  test('system clock returns the current time as a Date', () => {
    const clock = new SystemClock();
    const before = Date.now();

    const current = clock.now();

    expect(current).toBeInstanceOf(Date);
    expect(current.getTime()).toBeGreaterThanOrEqual(before);
    expect(current.getTime()).toBeLessThanOrEqual(Date.now());
  });

  test('mongo repositories persist and retrieve normalized users, active sessions, and audit events', async () => {
    await ensureIdentityIndexes(database);

    const userRepository = new MongoUserRepository(database);
    const sessionRepository = new MongoSessionRepository(database);
    const auditLog = new MongoAuditLog(database);

    const createdAt = new Date('2026-08-08T10:00:00.000Z');
    const expiresAt = new Date('2026-08-15T10:00:00.000Z');
    const revokedAt = new Date('2026-08-09T10:00:00.000Z');

    const insertedUser = await userRepository.insert({
      id: 'user-1',
      merchantId: 'merchant-1',
      email: 'merchant@example.com',
      passwordHash: 'bcrypt-hash',
      createdAt,
      updatedAt: createdAt,
    });

    expect(insertedUser).toEqual({
      id: 'user-1',
      merchantId: 'merchant-1',
      email: 'merchant@example.com',
      passwordHash: 'bcrypt-hash',
      createdAt,
      updatedAt: createdAt,
    });

    await expect(
      userRepository.findByNormalizedEmail('merchant@example.com'),
    ).resolves.toEqual(insertedUser);
    await expect(
      userRepository.findByNormalizedEmail('missing@example.com'),
    ).resolves.toBeNull();

    await sessionRepository.insert({
      id: 'session-1',
      userId: 'user-1',
      merchantId: 'merchant-1',
      tokenHash: 'token-hash-1',
      expiresAt,
      createdAt,
    });

    await expect(
      sessionRepository.findActiveByTokenHash(
        'token-hash-1',
        new Date('2026-08-09T00:00:00.000Z'),
      ),
    ).resolves.toEqual({
      id: 'session-1',
      userId: 'user-1',
      merchantId: 'merchant-1',
      tokenHash: 'token-hash-1',
      expiresAt,
      createdAt,
      revokedAt: null,
    });

    await expect(
      sessionRepository.revokeActiveByTokenHash('token-hash-1', revokedAt),
    ).resolves.toMatchObject({
      id: 'session-1',
      userId: 'user-1',
      merchantId: 'merchant-1',
      revokedAt,
    });

    await expect(
      sessionRepository.findActiveByTokenHash(
        'token-hash-1',
        new Date('2026-08-09T00:00:00.000Z'),
      ),
    ).resolves.toBeNull();

    await expect(
      sessionRepository.findActiveByTokenHash(
        'token-hash-1',
        new Date('2026-08-16T00:00:00.000Z'),
      ),
    ).resolves.toBeNull();

    await auditLog.record({
      action: 'identity.sign_up.succeeded',
      occurredAt: createdAt,
      userId: 'user-1',
      merchantId: 'merchant-1',
    });

    const auditEntries = await database
      .collection('identity_audit_log')
      .find({})
      .toArray();

    expect(auditEntries).toHaveLength(1);
    expect(auditEntries[0]).toMatchObject({
      action: 'identity.sign_up.succeeded',
      occurredAt: createdAt,
      userId: 'user-1',
      merchantId: 'merchant-1',
    });
    expect(auditEntries[0]).not.toHaveProperty('password');
    expect(auditEntries[0]).not.toHaveProperty('token');
  });

  test('identity indexes enforce unique email and token hash and expire sessions', async () => {
    await ensureIdentityIndexes(database);

    await database.collection('users').insertOne({
      id: 'user-1',
      merchantId: 'merchant-1',
      email: 'merchant@example.com',
      passwordHash: 'hash-1',
      createdAt: new Date('2026-08-08T10:00:00.000Z'),
      updatedAt: new Date('2026-08-08T10:00:00.000Z'),
    });

    await expect(
      database.collection('users').insertOne({
        id: 'user-2',
        merchantId: 'merchant-2',
        email: 'merchant@example.com',
        passwordHash: 'hash-2',
        createdAt: new Date('2026-08-08T10:01:00.000Z'),
        updatedAt: new Date('2026-08-08T10:01:00.000Z'),
      }),
    ).rejects.toMatchObject({ code: 11000 });

    await database.collection('sessions').insertOne({
      id: 'session-1',
      userId: 'user-1',
      merchantId: 'merchant-1',
      tokenHash: 'duplicate-token-hash',
      createdAt: new Date('2026-08-08T10:00:00.000Z'),
      expiresAt: new Date('2026-08-15T10:00:00.000Z'),
      revokedAt: null,
    });

    await expect(
      database.collection('sessions').insertOne({
        id: 'session-2',
        userId: 'user-2',
        merchantId: 'merchant-2',
        tokenHash: 'duplicate-token-hash',
        createdAt: new Date('2026-08-08T10:01:00.000Z'),
        expiresAt: new Date('2026-08-15T10:01:00.000Z'),
        revokedAt: null,
      }),
    ).rejects.toMatchObject({ code: 11000 });

    const sessionIndexes = await database.collection('sessions').indexes();

    expect(sessionIndexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'tokenHash_unique',
          unique: true,
          key: { tokenHash: 1 },
        }),
        expect.objectContaining({
          name: 'expiresAt_ttl',
          expireAfterSeconds: 0,
          key: { expiresAt: 1 },
        }),
      ]),
    );
  });

  test('mongo session repository returns an identity to only one concurrent revoker', async () => {
    const sessionRepository = new MongoSessionRepository(database);
    const createdAt = new Date('2026-08-08T10:00:00.000Z');
    const revokedAt = new Date('2026-08-09T10:00:00.000Z');

    await sessionRepository.insert({
      id: 'session-1',
      userId: 'user-1',
      merchantId: 'merchant-1',
      tokenHash: 'token-hash-1',
      expiresAt: new Date('2026-08-15T10:00:00.000Z'),
      createdAt,
    });

    const results = await Promise.all([
      sessionRepository.revokeActiveByTokenHash('token-hash-1', revokedAt),
      sessionRepository.revokeActiveByTokenHash('token-hash-1', revokedAt),
    ]);
    const revokedSessions = results.filter((session) => session !== null);

    expect(revokedSessions).toHaveLength(1);
    expect(revokedSessions[0]).toMatchObject({
      id: 'session-1',
      userId: 'user-1',
      merchantId: 'merchant-1',
      revokedAt,
    });
  });

  test('mongo user repository translates a duplicate email index violation', async () => {
    await ensureIdentityIndexes(database);
    const userRepository = new MongoUserRepository(database);
    const createdAt = new Date('2026-08-08T10:00:00.000Z');

    await userRepository.insert({
      id: 'user-1',
      merchantId: 'merchant-1',
      email: 'merchant@example.com',
      passwordHash: 'hash-1',
      createdAt,
      updatedAt: createdAt,
    });

    await expect(
      userRepository.insert({
        id: 'user-2',
        merchantId: 'merchant-2',
        email: 'merchant@example.com',
        passwordHash: 'hash-2',
        createdAt,
        updatedAt: createdAt,
      }),
    ).rejects.toMatchObject({ code: 'duplicate_email' });
  });
});
