import { Page, Locator } from '@playwright/test';

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
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }

  /**
   * Login and wait for dashboard redirect
   */
  async loginAndWaitForDashboard(username: string, password: string) {
    await this.login(username, password);
    await this.page.waitForURL('**/dashboard');
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
