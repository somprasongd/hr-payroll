import { Page, Locator } from '@playwright/test';

export interface BonusCycleData {
  payrollMonthDate: string;
  periodStartDate: string;
  periodEndDate: string;
}

/**
 * Page Object for Bonus Cycles
 */
export class BonusPage {
  readonly page: Page;
  readonly createButton: Locator;
  readonly statusFilter: Locator;
  readonly yearFilter: Locator;
  readonly cyclesTable: Locator;

  constructor(page: Page) {
    this.page = page;
    this.createButton = page.getByRole('button', { name: /สร้าง|create|เพิ่ม/i });
    this.statusFilter = page.locator('[data-testid="status-filter"]').or(
      page.getByLabel(/สถานะ|status/i)
    );
    this.yearFilter = page.locator('[data-testid="year-filter"]').or(
      page.getByLabel(/ปี|year/i)
    );
    this.cyclesTable = page.locator('table').or(page.locator('[data-testid="bonus-table"]'));
  }

  async goto() {
    await this.page.goto('/th/bonuses');
    await this.page.waitForLoadState('networkidle');
  }

  async openCreateDialog() {
    await this.createButton.click();
  }

  async createCycle(data: BonusCycleData) {
    await this.openCreateDialog();
    
    const dialog = this.page.locator('[role="dialog"]');
    
    // Set payroll month
    await dialog.getByLabel(/งวดจ่าย|payroll month/i).fill(data.payrollMonthDate);
    
    // Set period dates
    await dialog.getByLabel(/เริ่มนับ|start date/i).fill(data.periodStartDate);
    await dialog.getByLabel(/สิ้นสุด|end date/i).fill(data.periodEndDate);
    
    // Submit
    await dialog.getByRole('button', { name: /บันทึก|save/i }).click();
    await dialog.waitFor({ state: 'hidden' });
  }

  async gotoCycleDetail(cycleId: string) {
    const row = this.cyclesTable.getByRole('row').filter({ hasText: cycleId });
    await row.click();
    await this.page.waitForLoadState('networkidle');
  }

  async approveCycle() {
    await this.page.getByRole('button', { name: /อนุมัติ|approve/i }).click();
    await this.page.getByRole('button', { name: /ยืนยัน|confirm/i }).click();
  }

  async updateBonusItem(employeeId: string, bonusMonths: number, bonusAmount: number) {
    const row = this.page.locator('table').getByRole('row').filter({ hasText: employeeId });
    await row.getByRole('button', { name: /แก้ไข|edit/i }).click();
    
    const dialog = this.page.locator('[role="dialog"]');
    await dialog.getByLabel(/เท่า|months/i).fill(bonusMonths.toString());
    await dialog.getByLabel(/ยอดโบนัส|amount/i).fill(bonusAmount.toString());
    await dialog.getByRole('button', { name: /บันทึก|save/i }).click();
  }

  async filterByStatus(status: 'pending' | 'approved' | 'rejected' | 'all') {
    await this.statusFilter.click();
    await this.page.getByRole('option', { name: new RegExp(status, 'i') }).click();
  }

  async filterByYear(year: string) {
    await this.yearFilter.click();
    await this.page.getByRole('option', { name: year }).click();
  }

  getCycleRow(identifier: string): Locator {
    return this.cyclesTable.getByRole('row').filter({ hasText: identifier });
  }

  async getRowCount(): Promise<number> {
    const rows = this.cyclesTable.getByRole('row');
    const count = await rows.count();
    return Math.max(0, count - 1);
  }
}
