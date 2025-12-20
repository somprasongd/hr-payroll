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
    this.usernameInput = page.getByPlaceholder('กรอกชื่อผู้ใช้งาน');
    this.passwordInput = page.getByPlaceholder('กรอกรหัสผ่าน');
    this.loginButton = page.getByRole('button', { name: 'เข้าสู่ระบบ' });
    this.errorMessage = page.locator('[role="alert"]');
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
      await this.page.getByText('เลือกบริษัท').waitFor({ state: 'visible', timeout: 5000 });
      await this.page.locator('div, span, button').filter({ hasText: companyName }).first().click({ force: true });
    } catch (e) {
      // Optional, ignore if not found
    }
  }

  /**
   * Select a branch from the branch selector modal
   */
  async selectBranch(branchName: string = 'สำนักงานใหญ่') {
    try {
      // 1. Wait for confirm button to be visible (Short timeout as it might be skipped)
      const confirmButton = this.page.locator('button').filter({ hasText: 'ยืนยัน' });
      await confirmButton.waitFor({ state: 'visible', timeout: 5000 });
      
      // 2. Select the branch
      const option = this.page.locator('div, span, label, button').filter({ hasText: branchName }).last();
      await option.click({ force: true }).catch(() => {});

      // 3. Click "Confirm" button
      await confirmButton.click({ force: true });
      
      // 4. Wait for modal to disappear
      await confirmButton.waitFor({ state: 'hidden', timeout: 5000 });
    } catch (e) {
      console.log('Branch selector modal not appeared, might be redirected elsewhere.');
    }
  }

  /**
   * Complete login flow including optional company and branch selection
   */
  async fullLogin(username: string, password: string, company: string = 'DEFAULT', branch: string = 'สำนักงานใหญ่') {
    await this.login(username, password);
    await this.selectCompany(company);
    await this.selectBranch(branch);
    // Wait for the URL to change from /login but don't force /dashboard
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
