import { test, expect } from '@playwright/test';

test.describe('Bonus Management', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/th/bonuses');
    await page.waitForLoadState('networkidle');
  });

  test('ควรแสดงหน้า Bonus ได้ถูกต้อง', async ({ page }) => {
    // Check page loads with proper heading
    await expect(page.getByRole('heading').first()).toBeVisible();
    await expect(page.locator('table').or(page.getByText(/เลือกพนักงาน|กรุณาเลือก/i))).toBeVisible();
  });

  test('ควรมี Employee selector ได้', async ({ page }) => {
    await expect(page.getByRole('combobox').first()).toBeVisible();
  });
});
