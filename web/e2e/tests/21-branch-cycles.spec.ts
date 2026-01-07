import { test, expect } from '../fixtures/test.fixture';
import { testUsers } from '../fixtures/auth.fixture';

test.describe('Branch-Level Cycle Isolation & Constraints', () => {
  // Use a fresh context for each test in this file
  test.use({ storageState: { cookies: [], origins: [] } });

  const performFullLogin = async (loginPage: any, user: any, company: string, branch: string) => {
    await loginPage.goto();
    await loginPage.fullLogin(user.username, user.password, company, branch);
    await loginPage.page.waitForLoadState('networkidle');
  };

  test('แต่ละสาขาควรมี Bonus Cycle และ Salary Raise Cycle ของตัวเองได้อิสระ', async ({ page, loginPage }) => {
    // 1. ล็อกอินเข้าสาขา สำนักงานใหญ่ ของ COMPANY2
    await performFullLogin(loginPage, testUsers.admin2, 'COMPANY2', 'สำนักงานใหญ่');

    // ตรวจสอบว่าเห็น Bonus Cycle ของสาขานี้ (ควรมี 1 ใน dev seed ถ้า seed ใหม่แล้ว)
    await page.goto('/th/bonuses');
    await page.waitForLoadState('networkidle');
    // ต้องเห็นตาราง หรือข้อความว่ามีรายการ
    await expect(page.locator('table tbody tr')).toBeVisible();

    // 2. สลับไปสาขา สาขา 1
    const switcher = page.locator('header button').filter({ hasText: /สำนักงานใหญ่/ }).first();
    await switcher.click();
    await page.getByRole('menuitem', { name: 'สาขา 1' }).click();
    await page.waitForLoadState('networkidle');

    // ตรวจสอบว่าสาขานี้ก็ต้องมี Cycle ของตัวเอง (ถ้า seed มาแล้ว)
    await page.goto('/th/bonuses');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('table tbody tr')).toBeVisible();

    // 3. ทดสอบสร้าง Salary Raise Cycle ซ้ำในสาขาเดียวกันต้องไม่ได้
    await page.goto('/th/salary-raise');
    await page.waitForLoadState('networkidle');
    
    // กดปุ่มสร้าง (สมมุติว่ามีปุ่ม "สร้างรายการใหม่" หรืออะไรทำนองนี้)
    // หมายเหตุ: ถ้า dev seed สร้าง pending ไว้แล้ว การกดสร้างใหม่ควรจะติด Conflict
    const createBtn = page.getByRole('button', { name: /สร้าง|เพิ่ม/i }).first();
        // กดปุ่มสร้าง
        await createBtn.click();
        // กรอกฟอร์ม (วันเริ่มต้น และ วันสิ้นสุด)
        await page.getByLabel(/วันเริ่มต้น/i).fill('2025-01-01');
        await page.getByLabel(/วันสิ้นสุด/i).fill('2025-01-31');
        await page.getByRole('button', { name: /ยืนยัน|บันทึก/i }).click();

        // ควรเห็น Toast หรือ Error Message ว่าล้มเหลว (เพราะมีรายการค้างอยู่แล้ว)
        await expect(page.locator('body')).toContainText(/Failed to create cycle|already exists|มีรายการค้างอยู่/i, { timeout: 10000 });
  });

  test('แต่ละสาขาควรมี Payroll Run ของเดือนเดียวกันได้อิสระ', async ({ page, loginPage }) => {
    await performFullLogin(loginPage, testUsers.admin2, 'COMPANY2', 'สำนักงานใหญ่');

    // ตรวจสอบสาขา HQ
    await page.goto('/th/payroll');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('table tbody tr')).toBeVisible();

    // สลับไปสาขา สาขา 1
    const switcher = page.locator('header button').filter({ hasText: /สำนักงานใหญ่/ }).first();
    await switcher.click();
    await page.getByRole('menuitem', { name: 'สาขา 1' }).click();
    await page.waitForLoadState('networkidle');

    // ตรวจสอบสาขา สาขา 1
    await page.goto('/th/payroll');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('table tbody tr')).toBeVisible();
  });
});
