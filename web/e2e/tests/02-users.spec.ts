import { test, expect } from '@playwright/test';
import { UsersPage } from '../pages/users.page';

test.describe('Users Management', () => {
  // Use saved admin auth state
  test.use({ storageState: 'e2e/.auth/admin.json' });

  let usersPage: UsersPage;
  test.beforeEach(async ({ page }) => {
    usersPage = new UsersPage(page);
    await usersPage.goto();
  });

  test.describe('แสดงรายการผู้ใช้', () => {
    test('ควรแสดงหน้า Users ได้ถูกต้อง', async () => {
      await expect(usersPage.pageHeading).toBeVisible();
      await expect(usersPage.usersTable).toBeVisible();
      await expect(usersPage.createButton).toBeVisible();
    });

    test('ควรมี Admin user อย่างน้อย 1 คน', async () => {
      const rowCount = await usersPage.getRowCount();
      expect(rowCount).toBeGreaterThan(0);
      
      // Verify admin user is visible
      const adminRow = usersPage.getUserRow('admin');
      await expect(adminRow).toBeVisible();
    });
  });

  test.describe('สร้างผู้ใช้ใหม่', () => {
    test('ควรสร้าง HR user ใหม่สำเร็จ', async ({ page }) => {
      const testUsername = `test_hr_${Date.now()}`;
      await usersPage.createUser(testUsername, 'Test@123456', 'hr');
      
      await expect(page).toHaveURL(/\/admin\/users\/.*\/branches/, { timeout: 10000 });
      
      // Go back to users list to verify in table
      await usersPage.goto();
      const userRow = usersPage.getUserRow(testUsername);
      await expect(userRow).toBeVisible({ timeout: 5000 });
    });

    test('ควรแสดง Error เมื่อสร้าง user ด้วย username ซ้ำ', async ({ page }) => {
      // Try to create user with existing username
      await usersPage.openCreateDialog();
      
      const dialog = page.locator('[role="dialog"]');
      await dialog.waitFor({ state: 'visible' });
      
      await dialog.getByLabel('ชื่อผู้ใช้งาน').fill('admin'); // Existing user
      await dialog.getByLabel('รหัสผ่าน').fill('Test@123456');
      await dialog.getByRole('button', { name: 'สร้าง' }).click();

      await expect(dialog.getByText('ชื่อผู้ใช้งานนี้มีอยู่ในระบบแล้ว')).toBeVisible();
      await expect(page).toHaveURL(/\/admin\/users$/);
    });
  });

  // NOTE: Search and Filter tests removed - UI does not support these features
});
