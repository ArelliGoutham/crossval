import { expect, test, type Page } from '@playwright/test';

test('unauthenticated visitors are redirected to login and authenticated users land on dashboard', async ({
  page,
}) => {
  const uniqueEmail = `merchant-${Date.now()}@example.com`;

  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);

  await signUpThroughPage(page, uniqueEmail, 'correcthorse1');

  await expect(page).toHaveURL(/\/dashboard/);
});

async function signUpThroughPage(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto('/sign-up');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
}
