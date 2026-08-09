import { expect, test, type Page } from '@playwright/test';

function uniqueEmail(): string {
  return `merchant-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

async function signUp(page: Page, email: string): Promise<void> {
  await page.goto('/sign-up');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('correcthorse1');
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/v1/auth/sign-up') &&
        response.status() === 201,
    ),
    page.getByRole('button', { name: 'Create account' }).click(),
  ]);
  await expect(page).toHaveURL(/\/dashboard/);
}

async function openCreateOrderModal(page: Page): Promise<void> {
  await page.getByRole('button', { name: '+ New Order' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

test('assignment scenario: $1000 order, $400 + $600 payments reaches paid', async ({
  page,
}) => {
  const email = uniqueEmail();
  await signUp(page, email);

  // Open the create order modal
  await openCreateOrderModal(page);

  // Create a $1,000 order: 2 x $5.00 = 2 x 50000 cents = 100000 cents
  await page.getByLabel('Customer').fill('Acme Corp');

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);
  await page.getByLabel('Due Date').fill(dueDate.toISOString().slice(0, 10));

  const lineItems = page.locator('.line-item-row');
  await lineItems.first().locator('input').nth(0).fill('Widget');
  await lineItems.first().locator('input').nth(1).fill('2');
  await lineItems.first().locator('input').nth(2).fill('50000');

  await page.getByRole('button', { name: 'Create Order' }).click();

  // Wait for the modal to close and order to appear in the table
  await expect(page.getByRole('link', { name: 'Acme Corp' })).toBeVisible();
  await expect(page.locator('td .badge--pending')).toBeVisible();

  // Navigate to order detail
  await page.getByRole('link', { name: 'Acme Corp' }).click();
  await expect(page).toHaveURL(/\/orders\//);

  // Verify order total and status
  await expect(page.locator('.status--pending')).toBeVisible();
  await expect(page.getByText('$1000.00').first()).toBeVisible();

  // Record $400 payment (40000 cents)
  await page.getByLabel('Amount (in cents)').fill('40000');
  await page
    .getByLabel('Payment Date')
    .fill(new Date().toISOString().slice(0, 10));
  await page.getByRole('button', { name: 'Record Payment' }).click();

  // Status should be partially_paid, amount due $600.00
  await expect(page.locator('.status--partially_paid')).toBeVisible();
  await expect(page.getByText('$600.00').first()).toBeVisible();

  // Record $600 payment (60000 cents)
  await page.getByLabel('Amount (in cents)').fill('60000');
  await page.getByRole('button', { name: 'Record Payment' }).click();

  // Status should be paid, amount due $0.00
  await expect(page.locator('.status--paid')).toBeVisible();
  await expect(page.getByText('$0.00').first()).toBeVisible();

  // Payment form should be hidden when balance is zero
  await expect(page.getByLabel('Amount (in cents)')).not.toBeVisible();
});

test('over-payment is rejected with actionable error message', async ({
  page,
}) => {
  const email = uniqueEmail();
  await signUp(page, email);

  // Open the create order modal
  await openCreateOrderModal(page);

  // Create a $100 order (1 x 10000 cents)
  await page.getByLabel('Customer').fill('Test Corp');
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);
  await page.getByLabel('Due Date').fill(dueDate.toISOString().slice(0, 10));
  const lineItems = page.locator('.line-item-row');
  await lineItems.first().locator('input').nth(0).fill('Item');
  await lineItems.first().locator('input').nth(1).fill('1');
  await lineItems.first().locator('input').nth(2).fill('10000');
  await page.getByRole('button', { name: 'Create Order' }).click();

  await expect(page.getByRole('link', { name: 'Test Corp' })).toBeVisible();
  await page.getByRole('link', { name: 'Test Corp' }).click();

  // Try to pay more than the order total ($101 vs $100)
  await page.getByLabel('Amount (in cents)').fill('10100');
  await page
    .getByLabel('Payment Date')
    .fill(new Date().toISOString().slice(0, 10));
  await page.getByRole('button', { name: 'Record Payment' }).click();

  // Should show over-payment error with maximum allowed amount
  await expect(page.getByText(/exceeds remaining balance/i)).toBeVisible();
  await expect(page.getByText(/\$100\.00/).first()).toBeVisible();

  // Verify no payment was recorded
  await expect(page.getByText('No payments recorded yet.')).toBeVisible();
});
