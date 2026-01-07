import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';

test.describe('Login Restriction', () => {
  let loginPage: LoginPage;

  // Use a fresh context for this file to avoid session leaks from global setup
  test.use({ storageState: { cookies: [], origins: [] } });

  // Test data is seeded via SQL migration files:
  // - CI: handled by GitHub Actions workflow
  // - Local: run `psql $DB_URL -f migrations/test-seed/001_login_restriction_test.sql`

  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies();
    loginPage = new LoginPage(page);
  });

  test('ควรแสดงข้อความแจ้งเตือนเมื่อ Login ด้วยบริษัทที่ถูกระงับ (Suspended)', async ({ page }) => {
    const testAdminUser = 'admin_susp';
    const testAdminPass = 'changeme';

    await loginPage.goto();
    await loginPage.login(testAdminUser, testAdminPass);
    
    await expect(loginPage.errorMessage).toBeVisible({ timeout: 15000 });
    await expect(loginPage.errorMessage).toContainText(/ระงับ|ยกเลิก|ผู้ดูแลระบบ/i);
  });

  test('ควรแสดงข้อความแจ้งเตือนเมื่อ Login ด้วยบริษัทที่ถูกยกเลิก (Archived)', async ({ page }) => {
    const testAdminUser = 'admin_arch';
    const testAdminPass = 'changeme';

    await loginPage.goto();
    await loginPage.login(testAdminUser, testAdminPass);
    
    await expect(loginPage.errorMessage).toBeVisible({ timeout: 15000 });
    await expect(loginPage.errorMessage).toContainText(/ระงับ|ยกเลิก|ผู้ดูแลระบบ/i);
  });
});
