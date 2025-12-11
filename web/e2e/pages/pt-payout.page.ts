import { Page, Locator } from '@playwright/test';

/**
 * Page Object for PT Payouts
 */
export class PTPayoutPage {
  readonly page: Page;
  readonly createButton: Locator;
  readonly employeeFilter: Locator;
  readonly statusFilter: Locator;
  readonly payoutsTable: Locator;

  constructor(page: Page) {
    this.page = page;
    this.createButton = page.getByRole('button', { name: /สร้าง|create|เพิ่ม/i });
    this.employeeFilter = page.locator('[data-testid="employee-filter"]').or(
      page.getByLabel(/พนักงาน|employee/i).first()
    );
    this.statusFilter = page.locator('[data-testid="status-filter"]').or(
      page.getByLabel(/สถานะ|status/i)
    );
    this.payoutsTable = page.locator('table').or(page.locator('[data-testid="payouts-table"]'));
  }

  async goto() {
    await this.page.goto('/th/payouts/pt');
    await this.page.waitForLoadState('networkidle');
  }

  async gotoCreate(employeeId?: string) {
    if (employeeId) {
      await this.page.goto(`/th/payouts/pt/create?employeeId=${employeeId}`);
    } else {
      await this.createButton.click();
    }
    await this.page.waitForLoadState('networkidle');
  }

  async createPayout(employeeId: string, worklogDates: string[]) {
    await this.gotoCreate(employeeId);
    
    // Select employee if not pre-selected
    const employeeSelect = this.page.getByLabel(/พนักงาน|employee/i);
    if (await employeeSelect.isVisible()) {
      await employeeSelect.click();
      await this.page.getByRole('option').filter({ hasText: new RegExp(employeeId) }).click();
    }
    
    // Select worklogs by date
    for (const date of worklogDates) {
      const checkbox = this.page.locator('table')
        .getByRole('row')
        .filter({ hasText: date })
        .getByRole('checkbox');
      await checkbox.check();
    }
    
    // Submit
    await this.page.getByRole('button', { name: /สร้าง|create|บันทึก/i }).click();
    await this.page.waitForURL(/\/payouts\/pt/);
  }

  async markAsPaid(payoutId: string) {
    await this.page.goto(`/th/payouts/pt/${payoutId}`);
    await this.page.getByRole('button', { name: /จ่ายเงินแล้ว|mark as paid/i }).click();
    await this.page.getByRole('button', { name: /ยืนยัน|confirm/i }).click();
  }

  async cancelPayout(payoutId: string) {
    await this.page.goto(`/th/payouts/pt/${payoutId}`);
    await this.page.getByRole('button', { name: /ยกเลิก|cancel/i }).click();
    await this.page.getByRole('button', { name: /ยืนยัน|confirm/i }).click();
  }

  async filterByEmployee(employeeId: string) {
    await this.employeeFilter.click();
    await this.page.getByRole('option').filter({ hasText: new RegExp(employeeId) }).click();
  }

  async filterByStatus(status: 'to_pay' | 'paid' | 'cancelled' | 'all') {
    await this.statusFilter.click();
    await this.page.getByRole('option', { name: new RegExp(status, 'i') }).click();
  }

  getPayoutRow(identifier: string): Locator {
    return this.payoutsTable.getByRole('row').filter({ hasText: identifier });
  }

  async getRowCount(): Promise<number> {
    const rows = this.payoutsTable.getByRole('row');
    const count = await rows.count();
    return Math.max(0, count - 1);
  }
}
