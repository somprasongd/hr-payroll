import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object for Login page
 */
export class LoginPage {
  readonly page: Page;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    // Use placeholder text which is more specific
    this.usernameInput = page.getByPlaceholder('ชื่อผู้ใช้งาน');
    this.passwordInput = page.getByPlaceholder('รหัสผ่าน');
    this.loginButton = page.getByRole('button', { name: 'เข้าสู่ระบบ' });
    this.errorMessage = page.locator('[role="alert"]').filter({ hasNot: page.locator('#__next-route-announcer__') }).first();
  }

  /**
   * Navigate to login page
   */
  async goto() {
    // Login page is the root page at /[locale]
    await this.page.goto('/th');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Login with username and password
   */
  async login(username: string, password: string) {
    await this.usernameInput.waitFor({ state: 'visible', timeout: 10000 });
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }

  /**
   * Select a company from the company selector modal (For Super Admins)
   */
  async selectCompany(companyName: string = 'COMPANY2') {
    try {
      // Wait for company selection dialog
      const dialog = this.page.locator('[role="dialog"], .company-selector, [data-testid="company-selector"]');
      await dialog.waitFor({ state: 'visible', timeout: 3000 });
      
      // Find and click the company option
      const companyOption = this.page.locator('button, [role="option"]').filter({ hasText: companyName }).first();
      await companyOption.waitFor({ state: 'visible', timeout: 3000 });
      await companyOption.click();
      
      // Wait a bit for the selection to register
      await this.page.waitForTimeout(500);
    } catch (e: any) {
      console.log('Company selection skipped or failed:', e.message);
    }
  }

  /**
   * Select a branch from the branch selector modal
   */
  async selectBranch(branchName: string = 'สำนักงานใหญ่') {
    try {
      // 1. Wait for branch selection dialog to be visible
      const branchDialog = this.page.getByRole('heading', { name: /เลือกสาขา|Select Branch/i });
      await branchDialog.waitFor({ state: 'visible', timeout: 3000 });
      
      // 2. Find and click the branch button/option
      const branchOption = this.page.locator('button').filter({ hasText: branchName }).first();
      await branchOption.waitFor({ state: 'visible', timeout: 3000 });
      await branchOption.click();
      
      // 3. Wait a bit for selection to register
      await this.page.waitForTimeout(500);

      // 4. Click "Confirm" button if it exists
      const confirmButton = this.page.getByRole('button', { name: /ยืนยัน|Confirm/i });
      if (await confirmButton.isVisible({ timeout: 2000 })) {
        await confirmButton.click();
        // 5. Wait for dialog to close
        await confirmButton.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
      }
      
      // 6. Additional wait to ensure dialog is fully closed
      await this.page.waitForTimeout(500);
    } catch (e: any) {
      console.log('Branch selection skipped or failed:', e.message);
    }
  }

  /**
   * Complete login flow including optional company and branch selection
   */
  async fullLogin(username: string, password: string, company: string = 'DEFAULT', branch: string = 'สำนักงานใหญ่') {
    await this.login(username, password);
    
    // Wait for login to complete - either by URL change or selector appearing
    await this.page.waitForTimeout(2000); // Give time for page transition
    
    // Check if we already landed on a valid page (no selector needed)
    const currentUrl = this.page.url();
    if (currentUrl.includes('dashboard') || currentUrl.includes('super-admin') || currentUrl.includes('employees')) {
      await this.page.waitForLoadState('networkidle');
      return;
    }
    
    // Wait for either dashboard OR company/branch selector to appear
    try {
      await this.page.waitForFunction(() => {
        const url = window.location.href;
        return url.includes('dashboard') || 
               url.includes('super-admin') || 
               document.body.innerText.includes('เลือกบริษัท') || 
               document.body.innerText.includes('เลือกสาขา') ||
               document.body.innerText.includes('Select Company') ||
               document.body.innerText.includes('Select Branch');
      }, { timeout: 15000 });
    } catch (e) {
      console.log('Wait for UI transition timed out, checking current state...');
    }

    // Check URL again after waiting
    const urlAfterWait = this.page.url();
    if (urlAfterWait.includes('dashboard') || urlAfterWait.includes('super-admin') || urlAfterWait.includes('employees')) {
      await this.page.waitForLoadState('networkidle');
      return;
    }

    // Handle Company Selector if it appears (Super Admin or Multi-Company)
    try {
      const companyHeader = this.page.getByRole('heading', { name: /เลือกบริษัท|Select Company/i });
      if (await companyHeader.isVisible({ timeout: 3000 })) {
        console.log('Handling company selection...');
        await this.selectCompany(company);
        await this.page.waitForTimeout(1000);
      }
    } catch (e) {
      // No company selector - that's fine
    }

    // Handle Branch Selector if it appears
    try {
      const branchHeader = this.page.getByRole('heading', { name: /เลือกสาขา|Select Branch/i });
      if (await branchHeader.isVisible({ timeout: 3000 })) {
        console.log('Handling branch selection...');
        await this.selectBranch(branch);
        await this.page.waitForTimeout(1000);
      }
    } catch (e) {
      // No branch selector - that's fine
    }

    // Final wait for the target page - with longer timeout and retry mechanism
    try {
      await this.page.waitForURL(/\/dashboard|\/super-admin|\/employees/, { timeout: 15000 });
    } catch (e) {
      // If still not on target page, log current URL for debugging
      console.log('Still not on target page. Current URL:', this.page.url());
      // Take a screenshot for debugging
      const screenshot = await this.page.screenshot();
      console.log('Page content includes selectors:', {
        hasCompanySelector: await this.page.getByText('เลือกบริษัท').isVisible().catch(() => false),
        hasBranchSelector: await this.page.getByText('เลือกสาขา').isVisible().catch(() => false),
      });
      throw e;
    }
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Check if error message is visible
   */
  async isErrorVisible() {
    return await this.errorMessage.isVisible();
  }

  /**
   * Get error message text
   */
  async getErrorText() {
    return await this.errorMessage.textContent();
  }
}
