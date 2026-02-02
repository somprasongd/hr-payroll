import { test, expect } from '@playwright/test';

test.describe('Filters and Navigation', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });

  test('ควรเข้าถึง Dashboard ได้', async ({ page }) => {
    await page.goto('/th/dashboard');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 15000 });
  });

  test('ควรเข้าถึง Employees ได้', async ({ page }) => {
    await page.goto('/th/employees');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('table')).toBeVisible({ timeout: 15000 });
  });

  test('ควรเข้าถึง Payroll ได้', async ({ page }) => {
    await page.goto('/th/payroll');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 15000 });
  });

  test('ควรเข้าถึง Debt ได้', async ({ page }) => {
    await page.goto('/th/debt');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 15000 });
  });

  test('ควรเข้าถึง Settings ได้', async ({ page }) => {
    await page.goto('/th/settings');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 15000 });
  });
});
