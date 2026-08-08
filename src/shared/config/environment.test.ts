import { describe, expect, test } from 'vitest';

import { loadEnvironment } from '@/shared/config/environment';

const validEnvironment = {
  NODE_ENV: 'test',
  MONGODB_URI: 'mongodb://localhost:27018/?replicaSet=rs0',
  MONGODB_DB_NAME: 'crossval',
  APP_ORIGIN: 'http://localhost:3000',
  SESSION_TTL_DAYS: '7',
  BCRYPT_COST: '12',
  BCRYPT_DUMMY_HASH:
    '$2b$12$6pXXnmXUHS4PXpEO6JeKFuq/7/7myFbHw9ZouzgxJK1YLAUNhx4wa',
} as NodeJS.ProcessEnv;

describe('loadEnvironment', () => {
  test('parses valid externalized configuration', () => {
    expect(loadEnvironment(validEnvironment).bcryptCost).toBe(12);
  });

  test('rejects bcrypt cost below twelve', () => {
    expect(() =>
      loadEnvironment({ ...validEnvironment, BCRYPT_COST: '11' }),
    ).toThrow();
  });

  test.each(['6', '8'])(
    'rejects a session lifetime other than seven days',
    (sessionTtlDays) => {
      expect(() =>
        loadEnvironment({
          ...validEnvironment,
          SESSION_TTL_DAYS: sessionTtlDays,
        }),
      ).toThrow();
    },
  );

  test('rejects a dummy hash with a different bcrypt cost', () => {
    expect(() =>
      loadEnvironment({
        ...validEnvironment,
        BCRYPT_DUMMY_HASH:
          '$2b$10$6pXXnmXUHS4PXpEO6JeKFuq/7/7myFbHw9ZouzgxJK1YLAUNhx4wa',
      }),
    ).toThrow();
  });

  test.each([
    ['MONGODB_URI', 'not-a-url'],
    ['MONGODB_DB_NAME', ''],
    ['APP_ORIGIN', 'not-a-url'],
    ['SESSION_TTL_DAYS', '0'],
  ])('rejects an invalid %s value', (name, value) => {
    expect(() =>
      loadEnvironment({ ...validEnvironment, [name]: value }),
    ).toThrow();
  });
});
