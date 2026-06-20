import { Page, Locator } from '@playwright/test';

const authenticatedUrl = /\/(dashboard|super-admin|employees)(?:\/|$)/;

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
    this.errorMessage = page.getByRole('alert').filter({ hasText: /\S/ }).first();
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
    const dialog = this.page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible' });

    const companyOption = dialog.getByRole('button').filter({ hasText: companyName }).first();
    await companyOption.waitFor({ state: 'visible' });
    await companyOption.click();
  }

  /**
   * Select a branch from the branch selector modal
   */
  async selectBranch(branchName: string = 'สำนักงานใหญ่') {
    const dialog = this.page.getByRole('dialog');
    await dialog.getByRole('heading', { name: /เลือกสาขา|Select Branch/i }).waitFor({ state: 'visible' });

    const branchOption = dialog.getByRole('button').filter({ hasText: branchName }).first();
    await branchOption.waitFor({ state: 'visible' });
    await branchOption.click();

    const confirmButton = dialog.getByRole('button', { name: /ยืนยัน|Confirm/i });
    await confirmButton.click();
  }

  /**
   * Complete login flow including optional company and branch selection
   */
  async fullLogin(username: string, password: string, company: string = 'DEFAULT', branch: string = 'สำนักงานใหญ่') {
    await this.login(username, password);

    await this.page.waitForFunction(
      () => {
        const bodyText = document.body.innerText;
        return /\/(dashboard|super-admin|employees)(?:\/|$)/.test(window.location.pathname)
          || /เลือกบริษัท|Select Company|เลือกสาขา|Select Branch/i.test(bodyText)
          || Array.from(document.querySelectorAll('[role="alert"]'))
            .some((alert) => Boolean(alert.textContent?.trim()));
      },
      { timeout: 20_000 },
    );

    if (await this.errorMessage.isVisible()) {
      throw new Error(`Login failed: ${(await this.getErrorText())?.trim() || 'unknown error'}`);
    }

    if (authenticatedUrl.test(new URL(this.page.url()).pathname)) {
      return;
    }

    const companyHeading = this.page.getByRole('heading', { name: /เลือกบริษัท|Select Company/i });
    if (await companyHeading.isVisible()) {
      await this.selectCompany(company);
      await this.page.waitForFunction(
        () => /\/(dashboard|super-admin|employees)(?:\/|$)/.test(window.location.pathname)
          || /เลือกสาขา|Select Branch/i.test(document.body.innerText),
      );
    }

    const branchHeading = this.page.getByRole('heading', { name: /เลือกสาขา|Select Branch/i });
    if (await branchHeading.isVisible()) {
      await this.selectBranch(branch);
    }

    await this.page.waitForURL(authenticatedUrl, { timeout: 20_000 });
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
