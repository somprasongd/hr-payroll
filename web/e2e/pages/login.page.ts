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
      // 1. Wait for any branch button to appear
      await this.page.locator('button').filter({ hasText: branchName }).first().waitFor({ state: 'visible', timeout: 5000 });
      
      // 2. Click the branch
      const option = this.page.locator('button').filter({ hasText: branchName }).last();
      await option.click({ force: true });

      // 3. Click "Confirm" button (Check both Thai and English)
      const confirmButton = this.page.getByRole('button').filter({ hasText: /ยืนยัน|Confirm/i });
      await confirmButton.waitFor({ state: 'visible', timeout: 2000 });
      await confirmButton.click({ force: true });
      
      // 4. Wait for modal to disappear
      await confirmButton.waitFor({ state: 'hidden', timeout: 5000 });
    } catch (e: any) {
      console.log('Note: Branch selector flow skipped or failed:', e.message);
    }
  }

  /**
   * Complete login flow including optional company and branch selection
   */
  async fullLogin(username: string, password: string, company: string = 'DEFAULT', branch: string = 'สำนักงานใหญ่') {
    await this.login(username, password);
    
    // Wait for either dashboard OR company/branch selector to appear
    await this.page.waitForFunction(() => {
      const url = window.location.href;
      return url.includes('dashboard') || 
             url.includes('super-admin') || 
             document.body.innerText.includes('เลือกบริษัท') || 
             document.body.innerText.includes('เลือกสาขา') ||
             document.body.innerText.includes('Select Company') ||
             document.body.innerText.includes('Select Branch');
    }, { timeout: 30000 }).catch(() => console.log('Wait for UI transition timed out'));

    // Handle Company Selector if it appears (Super Admin or Multi-Company)
    const companyHeader = this.page.getByRole('heading', { name: /เลือกบริษัท|Select Company/i });
    if (await companyHeader.isVisible({ timeout: 5000 })) {
        console.log('Handling company selection...');
        await this.selectCompany(company);
    }

    // Handle Branch Selector if it appears
    const branchHeader = this.page.getByRole('heading', { name: /เลือกสาขา|Select Branch/i });
    if (await branchHeader.isVisible({ timeout: 5000 })) {
        console.log('Handling branch selection...');
        await this.selectBranch(branch);
    }

    // Final wait for the target page
    await this.page.waitForURL(/\/dashboard|\/super-admin|\/employees/, { timeout: 30000 });
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
