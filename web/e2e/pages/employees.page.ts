import { Page, Locator } from '@playwright/test';

export interface EmployeeFormData {
  employeeNumber: string;
  titleId?: string;
  firstName: string;
  lastName: string;
  idDocumentType?: string;
  idDocumentNumber: string;
  phone?: string;
  email?: string;
  employeeType: 'full_time' | 'part_time';
  basePayAmount: number;
  employmentStartDate: string;
  bankName?: string;
  bankAccountNo?: string;
  ssoContribute?: boolean;
  ssoDeclaredWage?: number;
  providentFundContribute?: boolean;
  withholdTax?: boolean;
  allowHousing?: boolean;
  allowDoctorFee?: boolean;
}

/**
 * Page Object for Employees management page
 */
export class EmployeesPage {
  readonly page: Page;
  readonly createLink: Locator;
  readonly searchInput: Locator;
  readonly searchButton: Locator;
  readonly typeFilter: Locator;
  readonly statusFilter: Locator;
  readonly employeesTable: Locator;
  readonly pageHeading: Locator;

  constructor(page: Page) {
    this.page = page;
    // Create is a LINK not button in this UI
    this.createLink = page.getByRole('link', { name: 'เพิ่มพนักงาน' });
    this.searchInput = page.getByPlaceholder('ค้นหาจากชื่อ, รหัส...');
    this.searchButton = page.getByRole('button', { name: 'ค้นหา' });
    // Comboboxes for filters
    this.typeFilter = page.getByRole('combobox').filter({ hasText: /ประเภทพนักงาน|ทุกประเภท/i }).first();
    this.statusFilter = page.getByRole('combobox').filter({ hasText: /สถานะ|ทุกสถานะ/i }).first();
    this.employeesTable = page.locator('table');
    this.pageHeading = page.getByRole('heading', { name: 'จัดการข้อมูลพนักงาน' });
  }

  /**
   * Navigate to employees page
   */
  async goto() {
    await this.page.goto('/th/employees');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Open create employee page
   */
  async openCreateForm() {
    await this.createLink.click();
    await this.page.waitForURL(/\/employees\/new/, { timeout: 10000 });
  }

  /**
   * Create a new employee (simplified version)
   */
  async createEmployee(data: EmployeeFormData) {
    await this.openCreateForm();
    
    // Basic info
    await this.page.getByLabel(/รหัสพนักงาน|employee number/i).fill(data.employeeNumber);
    await this.page.getByLabel(/ชื่อ|first name/i).first().fill(data.firstName);
    await this.page.getByLabel(/นามสกุล|last name/i).fill(data.lastName);
    await this.page.getByLabel(/เลขบัตร|id number/i).fill(data.idDocumentNumber);
    
    // Select employee type
    const typeSelect = this.page.getByLabel(/ประเภทพนักงาน|employee type/i);
    await typeSelect.click();
    const typeName = data.employeeType === 'full_time' ? 'ประจำ' : 'พาร์ทไทม์';
    await this.page.getByRole('option', { name: new RegExp(typeName, 'i') }).click();
    
    // Salary
    await this.page.getByLabel(/เงินเดือน|salary|base pay/i).fill(data.basePayAmount.toString());
    
    // Start date
    await this.page.getByLabel(/วันเริ่มงาน|start date/i).fill(data.employmentStartDate);
    
    // Submit
    await this.page.getByRole('button', { name: /บันทึก|save|create/i }).click();
    
    // Wait for redirect or success
    await this.page.waitForURL(/\/employees$/);
  }

  /**
   * Search employees and click search button
   */
  async search(query: string) {
    await this.searchInput.fill(query);
    await this.searchButton.click();
    await this.page.waitForTimeout(500); // wait for results
  }

  /**
   * Filter by status
   */
  async filterByStatus(status: 'active' | 'terminated' | 'all') {
    await this.statusFilter.click();
    const statusName = status === 'active' ? 'ทำงานอยู่' : status === 'terminated' ? 'ลาออก' : 'ทุกสถานะ';
    await this.page.getByRole('option', { name: statusName }).click();
  }

  /**
   * Filter by employee type
   */
  async filterByType(type: 'full_time' | 'part_time' | 'all') {
    await this.typeFilter.click();
    const typeName = type === 'full_time' ? 'พนักงานประจำ' : type === 'part_time' ? 'พนักงานชั่วคราว' : 'ทุกประเภท';
    await this.page.getByRole('option', { name: typeName }).click();
  }

  /**
   * Get employee row by employee number or name
   */
  getEmployeeRow(identifier: string): Locator {
    return this.employeesTable.getByRole('row').filter({ hasText: identifier });
  }

  /**
   * Click on employee row to view details
   */
  async viewEmployee(identifier: string) {
    const row = this.getEmployeeRow(identifier);
    await row.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get number of visible rows
   */
  async getRowCount(): Promise<number> {
    const rows = this.employeesTable.getByRole('row');
    const count = await rows.count();
    return count - 1; // Exclude header row
  }
}
