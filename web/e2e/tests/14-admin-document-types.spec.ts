import { test, expect } from '@playwright/test';

test.describe('Admin Document Types Management', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/th/admin/document-types');
    await page.waitForLoadState('networkidle');
  });

  test('ควรแสดงหน้า Document Types ได้ถูกต้อง', async ({ page }) => {
    // Check page heading
    await expect(page.getByRole('heading', { name: /ประเภทเอกสาร/i })).toBeVisible();
    // Check create button
    await expect(page.getByRole('button', { name: /เพิ่ม|สร้าง/i })).toBeVisible();
    // Check table is visible
    await expect(page.locator('table')).toBeVisible();
  });

  test('ควรเปิด dialog สร้างประเภทเอกสารได้', async ({ page }) => {
    await page.getByRole('button', { name: /เพิ่ม|สร้าง/i }).click();
    
    // Dialog should be visible
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    
    // Form fields should be visible - Document Types has code, nameTh, nameEn
    await expect(page.getByLabel(/รหัส|code/i)).toBeVisible();
  });
});
