import { test, expect } from '@playwright/test';

test.describe('Admin Org Profile', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/th/admin/org-profile');
    await page.waitForLoadState('networkidle');
  });

  test('ควรแสดงหน้า Org Profile ได้ถูกต้อง', async ({ page }) => {
    // Check page heading
    await expect(page.getByRole('heading', { name: /ข้อมูลองค์กร|org|profile/i })).toBeVisible();
  });

  test('ควรมี Tabs สำหรับจัดการข้อมูล', async ({ page }) => {
    // Check for tabs
    const tabs = page.getByRole('tablist');
    await expect(tabs).toBeVisible();
  });

  test('ควรแสดงฟอร์มข้อมูลองค์กร', async ({ page }) => {
    // Check for form elements
    const form = page.locator('form');
    const hasForm = await form.isVisible().catch(() => false);
    
    if (hasForm) {
      await expect(form).toBeVisible();
    } else {
      // Check for input fields directly
      const inputs = page.locator('input');
      await expect(inputs.first()).toBeVisible();
    }
  });
});
