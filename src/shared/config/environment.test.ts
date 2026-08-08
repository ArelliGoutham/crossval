import { describe, expect, test } from 'vitest';

import { loadEnvironment } from '@/shared/config/environment';

const validEnvironment = {
  NODE_ENV: 'test',
  MONGODB_URI: 'mongodb://localhost:27018/?replicaSet=rs0',
  MONGODB_DB_NAME: 'crossval',
  APP_ORIGIN: 'http://localhost:3000',
  SESSION_TTL_DAYS: '7',
  BCRYPT_COST: '12',
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
