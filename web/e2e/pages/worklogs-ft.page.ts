import { Page, Locator } from '@playwright/test';

export interface FTWorklogData {
  employeeId: string;
  workDate: string;
  entryType: 'late' | 'leave_day' | 'leave_hours' | 'leave_double' | 'ot';
  quantity: number;
}

/**
 * Page Object for Full-Time Worklogs page
 */
export class WorklogsFTPage {
  readonly page: Page;
  readonly pageHeading: Locator;
  readonly createButton: Locator;
  readonly employeeCombobox: Locator;
  readonly typeFilter: Locator;
  readonly statusFilter: Locator;
  readonly worklogsTable: Locator;
  readonly clearFilterButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageHeading = page.getByRole('heading', { name: 'บันทึกเวลาพนักงานประจำ' });
    this.createButton = page.getByRole('button', { name: 'บันทึกรายการใหม่' });
    this.employeeCombobox = page.getByRole('combobox').filter({ hasText: /ค้นหาพนักงาน/i });
    this.typeFilter = page.getByRole('combobox').filter({ hasText: /ทุกประเภท|ประเภท/i });
    this.statusFilter = page.getByRole('combobox').filter({ hasText: /ทุกสถานะ|สถานะ/i });
    this.worklogsTable = page.locator('table');
    this.clearFilterButton = page.getByRole('button', { name: 'ล้างตัวกรอง' });
  }

  async goto() {
    await this.page.goto('/th/worklogs/ft');
    await this.page.waitForLoadState('networkidle');
  }

  async filterByType(type: 'late' | 'leave' | 'ot' | 'all') {
    await this.typeFilter.click();
    const typeName = type === 'late' ? 'สาย' : type === 'leave' ? 'ลา' : type === 'ot' ? 'OT' : 'ทุกประเภท';
    await this.page.getByRole('option', { name: typeName }).click();
  }

  async filterByStatus(status: 'pending' | 'approved' | 'all') {
    await this.statusFilter.click();
    const statusName = status === 'pending' ? 'รออนุมัติ' : status === 'approved' ? 'อนุมัติแล้ว' : 'ทุกสถานะ';
    await this.page.getByRole('option', { name: statusName }).click();
  }

  async getRowCount(): Promise<number> {
    const rows = this.worklogsTable.locator('tbody tr');
    return await rows.count();
  }
}
