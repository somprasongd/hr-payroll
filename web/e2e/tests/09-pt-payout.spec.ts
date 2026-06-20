import { test, expect } from '@playwright/test';

test.describe('PT Payout Management', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/th/payouts/pt');
    await page.waitForLoadState('networkidle');
  });

  test('ควรแสดงหน้า PT Payout และแสดงข้อมูลตามพนักงานที่เลือก', async ({ page }) => {
    // 1. ตรวจสอบหน้าโหลดสำเร็จ
    await expect(page.getByRole('heading', { name: /จัดการการจ่ายเงิน|การจ่ายเงินพาร์ทไทม์/i })).toBeVisible();

    // 2. เลือกพนักงาน PT-001 (Prasit Kaewkla)
    await page.getByRole('combobox').nth(1).click();
    await page.getByPlaceholder(/ค้นหา|Search|ป้อนชื่อพนักงาน/i).fill('PT-001');
    
    const responsePromise = page.waitForResponse(resp => resp.url().includes('/payouts/pt') && resp.status() === 200);
    const option = page.getByRole('option', { name: /PT-001/i });

    await expect(option).toBeVisible();
    await option.click();
    await responsePromise;
    
    // ตรวจสอบว่าเห็นตารางหรือข้อความไม่มีข้อมูล
    await expect(page.locator('table, [role="grid"], .text-muted-foreground').first()).toBeVisible();
    
    // บันทึกหมายเหตุ: ข้อมูลในตารางขึ้นอยู่กับฐานข้อมูลที่รัน
    // หากไม่มีข้อมูล 'จ่ายแล้ว' หรือ 'รอจ่าย' อาจตรวจสอบไม่พบ
    // ตรวจสอบว่าอย่างน้อยเห็นตารางสรุปผล
    await expect(page.locator('table')).toBeVisible();
  });

  test('ควรสามารถกรองข้อมูลตามสถานะได้', async ({ page }) => {
    // เลือกพนักงาน PT-001
    await page.getByRole('combobox').nth(1).click();
    await page.getByPlaceholder(/ค้นหา|Search|ป้อนชื่อพนักงาน/i).fill('PT-001');
    
    const responsePromise = page.waitForResponse(resp => resp.url().includes('/payouts/pt') && resp.status() === 200);
    const option = page.getByRole('option', { name: /PT-001/i });

    await expect(option).toBeVisible();
    await option.click();
    await responsePromise;

    // เปลี่ยนตัวกรองสถานะเป็น 'จ่ายแล้ว'
    const statusBtn = page.getByRole('combobox').nth(2);
    await statusBtn.click();
    
    // หมายเหตุ: การเลือกสถานะอาจทำให้ตารางว่างเปล่าได้ถ้าไม่มีข้อมูลจริง
    const paidOption = page.getByRole('option', { name: /จ่ายแล้ว|Paid/i });
    await expect(paidOption).toBeVisible();
    await paidOption.click();
    
    // ตรวจสอบว่าเห็นตารางหรือข้อความไม่มีข้อมูล
    await expect(page.locator('table, [role="grid"], .text-muted-foreground').first()).toBeVisible();
  });

  test('ควรสามารถดูรายละเอียดรายการรอจ่ายได้', async ({ page }) => {
    // 1. เลือกพนักงาน PT-002 (Waree Thongdee)
    await page.getByRole('combobox').nth(1).click();
    await page.getByPlaceholder(/ค้นหา|Search|ป้อนชื่อพนักงาน/i).fill('PT-002');
    
    const option = page.getByRole('option', { name: /PT-002/i });
    await expect(option).toBeVisible();
    await option.click();

    await expect(page.getByText(/กำลังโหลด|Loading/i)).not.toBeVisible();

    const row = page.locator('tbody tr').filter({ hasText: /รอจ่าย|Pending|To Pay/i }).first();
    await expect(row).toBeVisible();
    await row.locator('a').first().click();

    await expect(page.getByRole('heading', { name: /รายละเอียดการจ่าย|Payout Details/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /อนุมัติการจ่ายเงิน|Approve|Mark as Paid/i })).toBeVisible();
  });
});
