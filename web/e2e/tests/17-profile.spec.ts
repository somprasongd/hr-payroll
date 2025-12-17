import { test, expect } from '@playwright/test';

test.describe('User Profile', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/th/profile');
    await page.waitForLoadState('networkidle');
  });

  test('ควรแสดงหน้า Profile ได้ถูกต้อง', async ({ page }) => {
    // Check page heading - uses h2 with text "ข้อมูลส่วนตัว"
    await expect(page.locator('h2').filter({ hasText: 'ข้อมูลส่วนตัว' })).toBeVisible();
  });

  test('ควรแสดงข้อมูลผู้ใช้ปัจจุบัน', async ({ page }) => {
    // Check for admin username display in the h3 username heading
    await expect(page.getByRole('heading', { name: 'admin', level: 3 })).toBeVisible();
  });

  test('ควรมีฟอร์มเปลี่ยนรหัสผ่าน', async ({ page }) => {
    // Check for password change section - CardTitle component
    await expect(page.locator('[data-slot="card-title"]').filter({ hasText: 'เปลี่ยนรหัสผ่าน' })).toBeVisible();
  });
});
