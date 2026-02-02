import { test, expect } from '@playwright/test';

test.describe('Admin Positions Management', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/th/admin/positions');
    await page.waitForLoadState('networkidle');
  });

  test('ควรแสดงหน้า Positions ได้ถูกต้อง', async ({ page }) => {
    // Check page heading
    await expect(page.getByRole('heading', { name: /ตำแหน่ง/i })).toBeVisible({ timeout: 15000 });
    // Check create button
    await expect(page.getByRole('button', { name: /เพิ่ม|สร้าง/i })).toBeVisible({ timeout: 15000 });
    // Check table is visible
    await expect(page.locator('table')).toBeVisible();
  });

  test('ควรเปิด dialog สร้างตำแหน่งได้', async ({ page }) => {
    const createBtn = page.getByRole('button', { name: /เพิ่ม|สร้าง/i });
    await expect(createBtn).toBeVisible({ timeout: 15000 });
    await createBtn.click();
    
    // Dialog should be visible
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    
    // Form fields should be visible
    await expect(page.getByLabel(/รหัส|code/i)).toBeVisible();
    await expect(page.getByLabel(/ชื่อ|name/i)).toBeVisible();
  });
});
