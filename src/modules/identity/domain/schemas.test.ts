import { describe, expect, test } from 'vitest';

import {
  loginInputSchema,
  signUpInputSchema,
} from '@/modules/identity/domain/schemas';

describe('identity credential schemas', () => {
  test('normalizes email and accepts a twelve-character password for sign-up', () => {
    expect(
      signUpInputSchema.parse({
        email: '  USER@Example.COM ',
        password: 'correcthorse1',
      }),
    ).toEqual({
      email: 'user@example.com',
      password: 'correcthorse1',
    });
  });

  test('normalizes email and accepts a twelve-character password for login', () => {
    expect(
      loginInputSchema.parse({
        email: '  USER@Example.COM ',
        password: 'correcthorse1',
      }),
    ).toEqual({
      email: 'user@example.com',
      password: 'correcthorse1',
    });
  });

  test('rejects passwords shorter than twelve characters', () => {
    expect(
      signUpInputSchema.safeParse({
        email: 'user@example.com',
        password: 'short',
      }).success,
    ).toBe(false);
  });
});
