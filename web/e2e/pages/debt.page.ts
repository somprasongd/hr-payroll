import { Page, Locator } from '@playwright/test';

export interface LoanData {
  employeeId: string;
  txnType: 'loan' | 'other';
  txnDate: string;
  amount: number;
  reason?: string;
  installments?: { amount: number; payrollMonthDate: string }[];
}

/**
 * Page Object for Debt/Loan Management
 */
export class DebtPage {
  readonly page: Page;
  readonly createButton: Locator;
  readonly employeeFilter: Locator;
  readonly typeFilter: Locator;
  readonly statusFilter: Locator;
  readonly debtTable: Locator;

  constructor(page: Page) {
    this.page = page;
    this.createButton = page.getByRole('button', { name: /สร้าง|create|เพิ่ม/i });
    this.employeeFilter = page.locator('[data-testid="employee-filter"]').or(
      page.getByLabel(/พนักงาน|employee/i).first()
    );
    this.typeFilter = page.locator('[data-testid="type-filter"]').or(
      page.getByLabel(/ประเภท|type/i)
    );
    this.statusFilter = page.locator('[data-testid="status-filter"]').or(
      page.getByLabel(/สถานะ|status/i)
    );
    this.debtTable = page.locator('table').or(page.locator('[data-testid="debt-table"]'));
  }

  async goto() {
    await this.page.goto('/th/debt');
    await this.page.waitForLoadState('networkidle');
  }

  async openCreateDialog() {
    await this.createButton.click();
  }

  async createLoan(data: LoanData) {
    await this.openCreateDialog();
    
    const dialog = this.page.locator('[role="dialog"]');
    
    // Select employee
    await dialog.getByLabel(/พนักงาน|employee/i).click();
    await this.page.getByRole('option').filter({ hasText: new RegExp(data.employeeId) }).click();
    
    // Select type
    await dialog.getByLabel(/ประเภท|type/i).click();
    const typeName = data.txnType === 'loan' ? 'เงินกู้' : 'อื่นๆ';
    await this.page.getByRole('option', { name: new RegExp(typeName, 'i') }).click();
    
    // Set date
    await dialog.getByLabel(/วันที่|date/i).fill(data.txnDate);
    
    // Set amount
    await dialog.getByLabel(/ยอดเงิน|amount/i).fill(data.amount.toString());
    
    // Set reason
    if (data.reason) {
      await dialog.getByLabel(/เหตุผล|reason/i).fill(data.reason);
    }
    
    // Add installments
    if (data.installments && data.installments.length > 0) {
      for (const inst of data.installments) {
        await dialog.getByRole('button', { name: /เพิ่มงวด|add installment/i }).click();
        const lastRow = dialog.locator('[data-testid="installment-row"]').last();
        await lastRow.getByLabel(/ยอด|amount/i).fill(inst.amount.toString());
        await lastRow.getByLabel(/งวด|month/i).fill(inst.payrollMonthDate);
      }
    }
    
    // Submit
    await dialog.getByRole('button', { name: /บันทึก|save/i }).click();
    await dialog.waitFor({ state: 'hidden' });
  }

  async approveLoan(loanId: string) {
    const row = this.debtTable.getByRole('row').filter({ hasText: loanId });
    await row.getByRole('button', { name: /อนุมัติ|approve/i }).click();
    
    // Confirm dialog
    await this.page.getByRole('button', { name: /ยืนยัน|confirm/i }).click();
  }

  async filterByEmployee(employeeId: string) {
    await this.employeeFilter.click();
    await this.page.getByRole('option').filter({ hasText: new RegExp(employeeId) }).click();
  }

  async filterByType(type: 'loan' | 'other' | 'all') {
    await this.typeFilter.click();
    const typeName = type === 'loan' ? 'เงินกู้' : type === 'other' ? 'อื่นๆ' : 'ทั้งหมด';
    await this.page.getByRole('option', { name: new RegExp(typeName, 'i') }).click();
  }

  async filterByStatus(status: 'pending' | 'approved' | 'all') {
    await this.statusFilter.click();
    await this.page.getByRole('option', { name: new RegExp(status, 'i') }).click();
  }

  getDebtRow(identifier: string): Locator {
    return this.debtTable.getByRole('row').filter({ hasText: identifier });
  }

  async getRowCount(): Promise<number> {
    const rows = this.debtTable.getByRole('row');
    const count = await rows.count();
    return Math.max(0, count - 1);
  }
}
