import { Page, Locator } from '@playwright/test';

/**
 * Page Object for Dashboard layout components (sidebar, header, logout)
 */
export class DashboardPage {
  readonly page: Page;
  readonly sidebar: Locator;
  readonly userMenuButton: Locator;
  readonly logoutButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sidebar = page.locator('aside').or(page.locator('[data-sidebar="sidebar"]'));
    // User menu button is in header (main area), shows "a admin admin"
    // Locate in header area to avoid sidebar "Admin" button
    this.userMenuButton = page.locator('main button').filter({ hasText: /^a\s+admin\s+admin$/i }).first()
      .or(page.locator('nav + main button').first());
    this.logoutButton = page.getByRole('menuitem', { name: /logout|ออกจากระบบ/i });
  }

  /**
   * Navigate to dashboard
   */
  async goto() {
    await this.page.goto('/th/dashboard');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Navigate using sidebar menu
   */
  async navigateTo(menuName: string) {
    const menuItem = this.sidebar.getByRole('link', { name: new RegExp(menuName, 'i') });
    await menuItem.click();
  }

  /**
   * Logout from the application
   */
  async logout() {
    await this.userMenuButton.click();
    await this.logoutButton.click();
    // Login page is at root /th
    await this.page.waitForURL(/\/th$/);
  }

  /**
   * Check if user is logged in (dashboard is accessible)
   */
  async isLoggedIn() {
    return await this.sidebar.isVisible();
  }
}

