import { test, expect } from '../fixtures/test.fixture';
import { testUsers } from '../fixtures/auth.fixture';
import { SuperAdminPage } from '../pages/super-admin.page';

test.describe('ระบบ Super Admin (Super Admin Portal)', () => {
  let superAdminPage: SuperAdminPage;

  // Use a fresh context for this file to avoid session leaks from global setup
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    superAdminPage = new SuperAdminPage(page);
  });

  // Test 1: Super Admin login and view companies
  test('Super Admin ควรเข้าถึงหน้ารายการบริษัทและเห็นข้อมูลทุกบริษัทได้', async ({ page, context, loginPage }) => {
    await context.clearCookies();
    await loginPage.goto();
    await page.waitForLoadState('networkidle');
    await loginPage.fullLogin(testUsers.superadmin.username, testUsers.superadmin.password, 'DEFAULT', 'สำนักงานใหญ่');
    
    // Check if redirected away from login
    await expect(page).toHaveURL(/\/(super-admin|dashboard|employees)/);

    // 2. ไปเมนูจัดการบริษัท (Super Admin Menu)
    await superAdminPage.goto();
    
    // Verify Company list visibility
    await expect(superAdminPage.companiesTable).toBeVisible();
    
    // Verify both companies are listed (Multi-tenancy visibility for Superadmin)
    await expect(page.getByRole('cell', { name: 'DEFAULT', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'COMPANY2', exact: true })).toBeVisible();
  });

  // Test 2: Normal admin restricted from superadmin area
  test('User ปกติไม่ควรเข้าถึงหน้า Super Admin ได้', async ({ page, loginPage }) => {
    // 1. Login เป็น Admin ปกติ (ต้องเลือกสาขาด้วยถ้ามีหลายสาขา)
    await loginPage.goto();
    await loginPage.fullLogin(testUsers.admin.username, testUsers.admin.password, 'DEFAULT', 'สำนักงานใหญ่');

    // 2. พยายามเข้าหน้า Super Admin Companies โดยตรงผ่าน URL
    await page.goto('/th/super-admin/companies');
    
    // 3. ควรถูกเตะกลับหรือแสดง 403 (พฤติกรรมปกติคือเด้งไป Dashboard หรือ Home)
    await expect(page).not.toHaveURL(/super-admin\/companies/);
  });
});
