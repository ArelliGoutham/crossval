// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { test, expect, vi } from 'vitest';

import { CredentialsForm } from '@/components/auth/credentials-form';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

test('credentials form presents validation feedback before submitting an invalid password', async () => {
  render(<CredentialsForm mode="sign-up" />);

  await userEvent.type(screen.getByLabelText('Password'), 'short');
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

  expect(
    await screen.findByText('Password must contain at least 12 characters.'),
  ).toBeVisible();
});
