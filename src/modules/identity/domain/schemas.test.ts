import { describe, expect, test } from 'vitest';

import {
  loginInputSchema,
  signUpInputSchema,
} from '@/modules/identity/domain/schemas';
import type { StoredUser } from '@/modules/identity/domain/types';

const storedUserWithoutUserId: StoredUser = {
  id: 'user_123',
  merchantId: 'merchant_123',
  email: 'user@example.com',
  passwordHash: 'password-hash',
  createdAt: new Date('2026-08-08T00:00:00.000Z'),
  updatedAt: new Date('2026-08-08T00:00:00.000Z'),
};

describe('identity credential schemas', () => {
  test('normalizes email and accepts a twelve-character password for sign-up', () => {
    expect(
      signUpInputSchema.parse({
        email: '  USER@Example.COM ',
        password: 'correcthorse',
      }),
    ).toEqual({
      email: 'user@example.com',
      password: 'correcthorse',
    });
  });

  test('normalizes email and accepts a twelve-character password for login', () => {
    expect(
      loginInputSchema.parse({
        email: '  USER@Example.COM ',
        password: 'correcthorse',
      }),
    ).toEqual({
      email: 'user@example.com',
      password: 'correcthorse',
    });
  });

  test('rejects an eleven-character password', () => {
    expect(
      signUpInputSchema.safeParse({
        email: 'user@example.com',
        password: 'correcthors',
      }).success,
    ).toBe(false);
  });

  test('allows stored users without a userId field', () => {
    expect(storedUserWithoutUserId.id).toBe('user_123');
  });
});
