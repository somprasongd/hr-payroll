import { Page, Locator } from '@playwright/test';

export interface SalaryAdvanceData {
  employeeId: string;
  amount: number;
  advanceDate: string;
  payrollMonthDate: string;
}

/**
 * Page Object for Salary Advance
 */
export class SalaryAdvancePage {
  readonly page: Page;
  readonly createButton: Locator;
  readonly employeeFilter: Locator;
  readonly payrollMonthFilter: Locator;
  readonly statusFilter: Locator;
  readonly advanceTable: Locator;

  constructor(page: Page) {
    this.page = page;
    this.createButton = page.getByRole('button', { name: /สร้าง|create|เพิ่ม/i });
    this.employeeFilter = page.locator('[data-testid="employee-filter"]').or(
      page.getByLabel(/พนักงาน|employee/i).first()
    );
    this.payrollMonthFilter = page.locator('[data-testid="payroll-month-filter"]');
    this.statusFilter = page.locator('[data-testid="status-filter"]').or(
      page.getByLabel(/สถานะ|status/i)
    );
    this.advanceTable = page.locator('table').or(page.locator('[data-testid="advance-table"]'));
  }

  async goto() {
    await this.page.goto('/th/salary-advance');
    await this.page.waitForLoadState('networkidle');
  }

  async openCreateDialog() {
    await this.createButton.click();
  }

  async createAdvance(data: SalaryAdvanceData) {
    await this.openCreateDialog();
    
    const dialog = this.page.locator('[role="dialog"]');
    
    // Select employee
    await dialog.getByLabel(/พนักงาน|employee/i).click();
    await this.page.getByRole('option').filter({ hasText: new RegExp(data.employeeId) }).click();
    
    // Set amount
    await dialog.getByLabel(/ยอดเงิน|amount/i).fill(data.amount.toString());
    
    // Set advance date
    await dialog.getByLabel(/วันที่รับ|advance date/i).fill(data.advanceDate);
    
    // Set payroll month
    await dialog.getByLabel(/งวด|payroll month/i).fill(data.payrollMonthDate);
    
    // Submit
    await dialog.getByRole('button', { name: /บันทึก|save/i }).click();
    await dialog.waitFor({ state: 'hidden' });
  }

  async filterByEmployee(employeeId: string) {
    await this.employeeFilter.click();
    await this.page.getByRole('option').filter({ hasText: new RegExp(employeeId) }).click();
  }

  async filterByStatus(status: 'pending' | 'processed' | 'all') {
    await this.statusFilter.click();
    await this.page.getByRole('option', { name: new RegExp(status, 'i') }).click();
  }

  getAdvanceRow(amount: string): Locator {
    return this.advanceTable.getByRole('row').filter({ hasText: amount });
  }

  async getRowCount(): Promise<number> {
    const rows = this.advanceTable.getByRole('row');
    const count = await rows.count();
    return Math.max(0, count - 1);
  }
}
