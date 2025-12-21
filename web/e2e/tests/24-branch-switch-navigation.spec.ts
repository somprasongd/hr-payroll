import { test, expect } from '../fixtures/test.fixture';
import { testUsers } from '../fixtures/auth.fixture';

test.describe('Branch Switching Navigation', () => {
  // Use a fresh context to avoid conflicts with global setup admin session
  test.use({ storageState: { cookies: [], origins: [] } });

  test('Should redirect to list page when switching branch on a detail page', async ({ page, loginPage }) => {
    // 1. Login as admin
    await loginPage.goto();
    await loginPage.fullLogin(testUsers.admin.username, testUsers.admin.password, 'DEFAULT', 'สำนักงานใหญ่');
    await page.waitForLoadState('networkidle');

    // 2. Go to an employee list first to find an employee
    await page.goto('/th/employees');
    await page.waitForLoadState('networkidle');

    // 3. Click on the first employee's "Edit" action
    const firstRow = page.locator('table tbody tr').first();
    await expect(firstRow).toBeVisible();
    
    // In our app, when there are 1-2 actions, they are rendered as buttons directly
    // Use the button with the edit icon or text if available
    const editButton = firstRow.getByRole('button').first(); // The first button is Edit based on EmployeesPage.tsx
    await editButton.click();
    
    // 4. Verify we are on the employee detail/edit page
    await expect(page).toHaveURL(/\/employees\/[0-9a-f-]+/);
    const currentUrl = page.url();
    console.log('Current URL before switch:', currentUrl);

    // 5. Open branch switcher in the header and switch to "สาขา 1"
    const branchSwitcher = page.locator('header button').filter({ hasText: /สำนักงานใหญ่|สาขา 1/ }).first();
    await branchSwitcher.click();
    
    // Use a simpler locator for the menu item
    const menuItem = page.locator('[role="menuitem"], [role="option"]').filter({ hasText: 'สาขา 1' }).last();
    await menuItem.waitFor({ state: 'visible', timeout: 5000 });
    await menuItem.click({ force: true });

    // 6. Verify we are redirected to the employee list page
    // The locale remains, so it should be /th/employees
    await expect(page).toHaveURL(/.*\/th\/employees$/, { timeout: 15000 });
    
    // 7. Verify we are no longer on the detail page
    expect(page.url()).not.toBe(currentUrl);
  });

  test('Should stay on the same page when switching branch on a list page (but refresh data)', async ({ page, loginPage }) => {
    // 1. Login as admin
    await loginPage.goto();
    await loginPage.fullLogin(testUsers.admin.username, testUsers.admin.password, 'DEFAULT', 'สำนักงานใหญ่');
    await page.waitForLoadState('networkidle');

    // 2. Go to Employees list
    await page.goto('/th/employees');
    await page.waitForLoadState('networkidle');

    const listUrl = page.url();

    // 3. Switch branch
    const branchSwitcher = page.locator('header button').filter({ hasText: /สำนักงานใหญ่|สาขา 1/ }).first();
    await branchSwitcher.click();
    
    const menuItem = page.locator('[role="menuitem"], [role="option"]').filter({ hasText: 'สาขา 1' }).last();
    await menuItem.waitFor({ state: 'visible', timeout: 5000 });
    await menuItem.click({ force: true });

    // 4. Verify we are still on the list page
    await expect(page).toHaveURL(listUrl, { timeout: 10000 });
  });
});
