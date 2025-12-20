import { Page, Locator } from '@playwright/test';

export class SuperAdminPage {
  readonly page: Page;
  readonly pageHeading: Locator;
  readonly companiesTable: Locator;
  readonly createCompanyLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageHeading = page.getByRole('heading', { name: /จัดการบริษัท|Companies/i });
    this.companiesTable = page.locator('table');
    this.createCompanyLink = page.getByRole('link', { name: /สร้างบริษัท|Create Company/i });
  }

  async goto() {
    await this.page.goto('/th/super-admin/companies');
  }

  async getCompanyCount() {
    return await this.companiesTable.locator('tbody tr').count();
  }

  async getCompanyRow(code: string) {
    return this.companiesTable.locator('tbody tr').filter({ hasText: code });
  }
}
