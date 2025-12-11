import { Page, Locator } from '@playwright/test';

export interface PayrollRunData {
  payrollMonthDate: string;
  periodStartDate: string;
  payDate: string;
  ssoRateEmployee: number;
  ssoRateEmployer: number;
}

/**
 * Page Object for Payroll Runs
 */
export class PayrollPage {
  readonly page: Page;
  readonly createButton: Locator;
  readonly yearFilter: Locator;
  readonly monthFilter: Locator;
  readonly statusFilter: Locator;
  readonly payrollTable: Locator;

  constructor(page: Page) {
    this.page = page;
    this.createButton = page.getByRole('button', { name: /สร้าง|create|เพิ่ม/i });
    this.yearFilter = page.locator('[data-testid="year-filter"]').or(
      page.getByLabel(/ปี|year/i)
    );
    this.monthFilter = page.locator('[data-testid="month-filter"]');
    this.statusFilter = page.locator('[data-testid="status-filter"]').or(
      page.getByLabel(/สถานะ|status/i)
    );
    this.payrollTable = page.locator('table').or(page.locator('[data-testid="payroll-table"]'));
  }

  async goto() {
    await this.page.goto('/th/payroll');
    await this.page.waitForLoadState('networkidle');
  }

  async openCreateDialog() {
    await this.createButton.click();
  }

  async createPayrollRun(data: PayrollRunData) {
    await this.openCreateDialog();
    
    const dialog = this.page.locator('[role="dialog"]');
    
    // Set payroll month
    await dialog.getByLabel(/งวดเดือน|payroll month/i).fill(data.payrollMonthDate);
    
    // Set period start
    await dialog.getByLabel(/วันเริ่มนับ|period start/i).fill(data.periodStartDate);
    
    // Set pay date
    await dialog.getByLabel(/วันจ่าย|pay date/i).fill(data.payDate);
    
    // Set SSO rates (UI shows as %, stored as decimal)
    await dialog.getByLabel(/SSO ลูกจ้าง|employee sso/i).fill(data.ssoRateEmployee.toString());
    await dialog.getByLabel(/SSO นายจ้าง|employer sso/i).fill(data.ssoRateEmployer.toString());
    
    // Submit
    await dialog.getByRole('button', { name: /บันทึก|save|สร้าง/i }).click();
    await dialog.waitFor({ state: 'hidden' });
  }

  async gotoPayrollDetail(runId: string) {
    const row = this.payrollTable.getByRole('row').filter({ hasText: runId });
    await row.click();
    await this.page.waitForLoadState('networkidle');
  }

  async approvePayroll() {
    await this.page.getByRole('button', { name: /อนุมัติ|approve/i }).click();
    await this.page.getByRole('button', { name: /ยืนยัน|confirm/i }).click();
  }

  async openPayslipEdit(employeeId: string) {
    const row = this.page.locator('table').getByRole('row').filter({ hasText: employeeId });
    await row.click();
    await this.page.waitForLoadState('networkidle');
  }

  async updatePayslip(updates: Record<string, string | number>) {
    const dialog = this.page.locator('[role="dialog"]');
    
    for (const [field, value] of Object.entries(updates)) {
      const input = dialog.getByLabel(new RegExp(field, 'i'));
      await input.fill(value.toString());
    }
    
    await dialog.getByRole('button', { name: /บันทึก|save/i }).click();
  }

  async filterByYear(year: string) {
    await this.yearFilter.click();
    await this.page.getByRole('option', { name: year }).click();
  }

  async filterByStatus(status: 'pending' | 'approved' | 'all') {
    await this.statusFilter.click();
    await this.page.getByRole('option', { name: new RegExp(status, 'i') }).click();
  }

  async searchPayslip(query: string) {
    await this.page.getByPlaceholder(/ค้นหา|search/i).fill(query);
    await this.page.waitForTimeout(500);
  }

  async filterPayslipByType(type: 'full_time' | 'part_time' | 'all') {
    const typeFilter = this.page.locator('[data-testid="employee-type-filter"]');
    await typeFilter.click();
    const typeName = type === 'full_time' ? 'ประจำ' : type === 'part_time' ? 'พาร์ทไทม์' : 'ทั้งหมด';
    await this.page.getByRole('option', { name: new RegExp(typeName, 'i') }).click();
  }

  getPayrollRow(identifier: string): Locator {
    return this.payrollTable.getByRole('row').filter({ hasText: identifier });
  }

  async getRowCount(): Promise<number> {
    const rows = this.payrollTable.getByRole('row');
    const count = await rows.count();
    return Math.max(0, count - 1);
  }
}
