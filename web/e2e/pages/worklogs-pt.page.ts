import { Page, Locator } from '@playwright/test';

/**
 * Page Object for Part-Time Worklogs page
 */
export class WorklogsPTPage {
  readonly page: Page;
  readonly pageHeading: Locator;
  readonly createButton: Locator;
  readonly employeeCombobox: Locator;
  readonly statusFilter: Locator;
  readonly worklogsTable: Locator;
  readonly clearFilterButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageHeading = page.getByRole('heading', { name: 'บันทึกเวลาพาร์ทไทม์' });
    this.createButton = page.getByRole('button', { name: 'บันทึกเวลาใหม่' });
    this.employeeCombobox = page.getByRole('combobox').filter({ hasText: /เลือกพนักงาน/i });
    this.statusFilter = page.getByRole('combobox').filter({ hasText: /ทุกสถานะ|สถานะ/i });
    this.worklogsTable = page.locator('table');
    this.clearFilterButton = page.getByRole('button', { name: 'ล้างตัวกรอง' });
  }

  async goto() {
    await this.page.goto('/th/worklogs/pt');
    await this.page.waitForLoadState('networkidle');
  }

  async filterByStatus(status: 'pending' | 'to_pay' | 'paid' | 'all') {
    await this.statusFilter.click();
    const statusName = status === 'pending' ? 'รออนุมัติ' : status === 'to_pay' ? 'รอจ่าย' : status === 'paid' ? 'จ่ายแล้ว' : 'ทุกสถานะ';
    await this.page.getByRole('option', { name: statusName }).click();
  }

  async getRowCount(): Promise<number> {
    const rows = this.worklogsTable.locator('tbody tr');
    return await rows.count();
  }
}

