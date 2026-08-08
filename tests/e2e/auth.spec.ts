import { expect, test, type Page } from '@playwright/test';

test('unauthenticated dashboard visitors are redirected to login', async ({
  page,
}) => {
  await page.goto('/dashboard');

  await expect(page).toHaveURL(/\/login/);
});

test('unauthenticated order visitors are redirected to login', async ({
  page,
}) => {
  await page.goto('/orders/order-123');

  await expect(page).toHaveURL(/\/login/);
});

test('successful sign-up lands the merchant on the dashboard', async ({
  page,
}) => {
  await signUpThroughPage(page, uniqueEmail(), 'correcthorse1');

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});

test('successful login lands the merchant on the dashboard', async ({
  page,
  context,
}) => {
  const email = uniqueEmail();

  await signUpThroughPage(page, email, 'correcthorse1');
  await context.clearCookies();

  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('correcthorse1');
  await page.getByRole('button', { name: 'Log in' }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});

test('authenticated merchants are redirected from login and sign-up to dashboard', async ({
  page,
}) => {
  await signUpThroughPage(page, uniqueEmail(), 'correcthorse1');

  await page.goto('/login');
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  await page.goto('/sign-up');
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});

async function signUpThroughPage(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto('/sign-up');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/v1/auth/sign-up') &&
        response.status() === 201,
    ),
    page.getByRole('button', { name: 'Create account' }).click(),
  ]);
}

function uniqueEmail(): string {
  return `merchant-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}
