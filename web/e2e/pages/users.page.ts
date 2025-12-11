import { Page, Locator } from '@playwright/test';

/**
 * Page Object for Users management page
 */
export class UsersPage {
  readonly page: Page;
  readonly createButton: Locator;
  readonly usersTable: Locator;
  readonly pageHeading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.createButton = page.getByRole('button', { name: 'สร้างผู้ใช้งาน' });
    this.usersTable = page.locator('table');
    this.pageHeading = page.getByRole('heading', { name: 'จัดการผู้ใช้งาน' });
  }

  /**
   * Navigate to users page
   */
  async goto() {
    await this.page.goto('/th/admin/users');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Open create user dialog
   */
  async openCreateDialog() {
    await this.createButton.click();
  }

  /**
   * Create a new user
   * @param role - 'admin' maps to 'ผู้ดูแลระบบ', 'hr' maps to 'ฝ่ายบุคคล'
   */
  async createUser(username: string, password: string, role: 'admin' | 'hr') {
    await this.openCreateDialog();
    
    const dialog = this.page.locator('[role="dialog"]');
    await dialog.waitFor({ state: 'visible' });
    
    // Fill username
    await dialog.getByLabel('ชื่อผู้ใช้งาน').fill(username);
    
    // Fill password
    await dialog.getByLabel('รหัสผ่าน').fill(password);
    
    // Select role - click combobox then select option
    const roleName = role === 'admin' ? 'ผู้ดูแลระบบ' : 'ฝ่ายบุคคล';
    await dialog.getByLabel('สิทธิ์การใช้งาน').click();
    await this.page.getByRole('option', { name: roleName }).click();
    
    // Submit
    await dialog.getByRole('button', { name: 'สร้าง' }).click();
    
    // Wait for dialog to close or error
    await this.page.waitForTimeout(1000);
  }

  /**
   * Get user row by username
   */
  getUserRow(username: string): Locator {
    return this.usersTable.getByRole('row').filter({ hasText: username });
  }

  /**
   * Get number of visible rows (excluding header)
   */
  async getRowCount(): Promise<number> {
    const rows = this.usersTable.locator('tbody tr');
    return await rows.count();
  }

  /**
   * Check if user exists in table
   */
  async userExists(username: string): Promise<boolean> {
    const row = this.getUserRow(username);
    return await row.isVisible();
  }
}

