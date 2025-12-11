import { test, expect } from '@playwright/test';

test.describe('Salary Advance', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/th/salary-advance');
    await page.waitForLoadState('networkidle');
  });

  test('ควรแสดงหน้า Salary Advance ได้ถูกต้อง', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'รายการเบิกเงินล่วงหน้า' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'สร้างรายการ' })).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
  });

  test('ควรมี Employee selector ได้', async ({ page }) => {
    await expect(page.getByRole('combobox').filter({ hasText: /เลือกพนักงาน/i })).toBeVisible();
  });

  test('ควรมี Status filter ได้', async ({ page }) => {
    await expect(page.getByRole('combobox').filter({ hasText: /ทุกสถานะ/i })).toBeVisible();
  });
});
