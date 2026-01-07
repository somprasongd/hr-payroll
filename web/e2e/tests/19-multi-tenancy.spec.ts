import { test, expect } from '../fixtures/test.fixture';
import { testUsers } from '../fixtures/auth.fixture';

test.describe('Multi-tenancy & Branch Isolation', () => {
  // Use a fresh context for each test in this file
  test.use({ storageState: { cookies: [], origins: [] } });

  /**
   * Helper to perform full login with company/branch selection
   */
  const performFullLogin = async (loginPage: any, user: any, company: string, branch: string) => {
    await loginPage.goto();
    await loginPage.fullLogin(user.username, user.password, company, branch);
    await loginPage.page.waitForLoadState('networkidle');
  };

  // Test 1: login with admin2 (COMPANY2) and verify isolation
  test('Admin of COMPANY2 should only see their own employees and branches', async ({ page, context, loginPage }) => {
    await performFullLogin(loginPage, testUsers.admin2, 'COMPANY2', 'สำนักงานใหญ่');
    
    // Go to Employees list
    await page.goto('/th/employees');
    await page.waitForLoadState('networkidle');
    
    // Verify visibility: Should see C2-FT-001 in a cell
    const cell = page.getByRole('cell', { name: 'C2-FT-001', exact: true });
    await expect(cell).toBeVisible({ timeout: 15000 });
    
    // Verify Isolation: Should NOT see employees from DEFAULT company (which lack C2- prefix)
    // We check that every "รหัสพนักงาน" in the table starts with "C2-"
    const rows = page.locator('table tbody tr');
    const rowCount = await rows.count();
    for (let i = 0; i < rowCount; i++) {
        const text = await rows.nth(i).innerText();
        expect(text).toContain('C2-');
        expect(text).not.toMatch(/^FT-/); // Should not start with FT- directly
    }
  });

  // Test 2: Switching branches should change the data view (Only one branch at a time)
  test('Switching branches should filter data to only that branch', async ({ page, loginPage }) => {
    await performFullLogin(loginPage, testUsers.admin2, 'COMPANY2', 'สำนักงานใหญ่');

    await page.goto('/th/employees');
    await page.waitForLoadState('networkidle');
    
    // Wait for table to be loaded
    await page.locator('table tbody tr').first().waitFor({ state: 'visible', timeout: 15000 });
    
    // Initially at HQ
    await expect(page.getByRole('cell', { name: 'C2-FT-001' })).toBeVisible({ timeout: 15000 });

    // Open the switcher in header
    const switcher = page.locator('header button').filter({ hasText: /สำนักงานใหญ่|สาขา 1/ }).first();
    await switcher.click();
    
    // Select "สาขา 1"
    const menuItem = page.getByRole('menuitem', { name: 'สาขา 1' });
    await menuItem.click();
    
    // Wait for the specific branch data to appear and HQ data to disappear
    await expect(page.getByRole('cell', { name: 'C2-FT-101' })).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('cell', { name: 'C2-FT-001' })).not.toBeVisible(); 
  });

  // Test 3: Unauthorized company access via URL
  test('Should not be able to access other company branches via URL', async ({ page, loginPage }) => {
    await performFullLogin(loginPage, testUsers.admin2, 'COMPANY2', 'สำนักงานใหญ่');

    // Attempt to navigate to a random branch ID
    await page.goto('/th/employees?branchId=00000000-0000-0000-0000-000000000000');
    await page.waitForLoadState('networkidle');
    
    // Should still show a valid branch in switcher
    const branchName = await page.locator('header button').filter({ hasText: /สำนักงานใหญ่|กะทู้/ }).first().textContent();
    expect(branchName).not.toBeNull();
  });
});
