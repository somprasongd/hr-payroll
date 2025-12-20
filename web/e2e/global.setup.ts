import { test as setup, expect } from '@playwright/test';
import { testUsers } from './fixtures/auth.fixture';
import { LoginPage } from './pages/login.page';
import path from 'path';

const adminAuthFile = path.join(__dirname, '.auth/admin.json');

/**
 * Global setup - Login as admin and save auth state
 */
setup('authenticate as admin', async ({ page }) => {
  const loginPage = new LoginPage(page);
  
  // Go to login page
  await loginPage.goto();
  
  // Login with admin credentials and select company/branch
  await loginPage.fullLogin(testUsers.admin.username, testUsers.admin.password, 'DEFAULT', 'สำนักงานใหญ่');
  
  // Verify we're logged in
  await expect(page).toHaveURL(/dashboard/);
  
  // Save authentication state
  await page.context().storageState({ path: adminAuthFile });
});
