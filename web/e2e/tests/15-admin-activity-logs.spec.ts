import { test, expect } from '@playwright/test';

test.describe('Admin Activity Logs', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/th/admin/activity-logs');
    await page.waitForLoadState('networkidle');
  });

  test('ควรแสดงหน้า Activity Logs ได้ถูกต้อง', async ({ page }) => {
    // Check page heading
    await expect(page.getByRole('heading', { name: /ประวัติ|activity|log/i })).toBeVisible();
  });

  test('ควรมี Filter controls ได้', async ({ page }) => {
    // Check for filter comboboxes
    const comboboxes = page.getByRole('combobox');
    await expect(comboboxes.first()).toBeVisible();
  });

  test('ควรแสดงรายการ Activity Logs หรือ Empty state', async ({ page }) => {
    // Either table or empty state should be visible
    const table = page.locator('table');
    const emptyState = page.getByText(/ไม่พบ|no data|no results|ไม่มี/i);
    
    const hasTable = await table.isVisible().catch(() => false);
    const hasEmptyState = await emptyState.isVisible().catch(() => false);
    
    expect(hasTable || hasEmptyState).toBeTruthy();
  });
});
