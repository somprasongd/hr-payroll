import { test, expect } from '@playwright/test';

test.describe('Payroll Management', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/th/payroll');
    await page.waitForLoadState('networkidle');
  });

  test('ควรแสดงหน้า Payroll ได้ถูกต้อง', async ({ page }) => {
    // Check page loads with proper heading
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('table').or(page.getByText(/เลือก|กรุณา/i))).toBeVisible();
  });

  test('ควรมี Filter controls ได้', async ({ page }) => {
    // Page should have some filter controls
    const comboboxes = page.getByRole('combobox');
    await expect(comboboxes.first()).toBeVisible();
  });
});
