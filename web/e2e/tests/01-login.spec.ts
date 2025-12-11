import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';

test.describe('Login', () => {
  // Login tests should NOT use stored auth state
  test.use({ storageState: { cookies: [], origins: [] } });

  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  test.describe('ทดสอบ Login', () => {
    test('ควรแสดงหน้า Login ได้ถูกต้อง', async ({ page }) => {
      await expect(loginPage.usernameInput).toBeVisible();
      await expect(loginPage.passwordInput).toBeVisible();
      await expect(loginPage.loginButton).toBeVisible();
    });

    test('ควร Login สำเร็จด้วย Admin credentials', async ({ page }) => {
      const adminUsername = process.env.TEST_ADMIN_USERNAME || 'admin';
      const adminPassword = process.env.TEST_ADMIN_PASSWORD || 'changeme';
      
      await loginPage.login(adminUsername, adminPassword);
      
      // Should redirect to dashboard
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    });

    test('ควรแสดง Error เมื่อใส่ Password ผิด', async ({ page }) => {
      await loginPage.login('admin', 'wrongpassword');
      
      // Should show error message
      await expect(loginPage.errorMessage).toBeVisible({ timeout: 10000 });
    });

    test('ควรแสดง Error เมื่อไม่กรอกข้อมูล', async ({ page }) => {
      // Fill with short values to trigger validation
      await loginPage.usernameInput.fill('ab');
      await loginPage.passwordInput.fill('123');
      await loginPage.loginButton.click();
      
      // Should show validation errors
      await expect(page.getByText(/ต้องมีความยาว/i).first()).toBeVisible({ timeout: 5000 });
    });
  });
});
