import { expect, test } from 'vitest';

test('test runner is configured', () => {
  expect(process.env.NODE_ENV).toBe('test');
});
