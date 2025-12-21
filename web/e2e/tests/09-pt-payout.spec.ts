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
    
    let responsePromise = page.waitForResponse(resp => resp.url().includes('/payouts/pt') && resp.status() === 200);
    await page.getByRole('option', { name: /PT-001/i }).click();
    await responsePromise;
    
    // ตรวจสอบว่าเห็นรายการในตาราง
    await expect(page.locator('table')).toBeVisible();
    
    // PT-001 ควรมีทั้งรายการที่ 'จ่ายแล้ว' และ 'รอจ่าย'
    await expect(page.getByText(/จ่ายแล้ว|Paid/i).first()).toBeVisible();
    await expect(page.getByText(/รอจ่าย|Pending|To Pay/i).first()).toBeVisible();
  });

  test('ควรสามารถกรองข้อมูลตามสถานะได้', async ({ page }) => {
    // เลือกพนักงาน PT-001
    await page.getByRole('combobox').nth(1).click();
    await page.getByPlaceholder(/ค้นหา|Search|ป้อนชื่อพนักงาน/i).fill('PT-001');
    
    let responsePromise = page.waitForResponse(resp => resp.url().includes('/payouts/pt') && resp.status() === 200);
    await page.getByRole('option', { name: /PT-001/i }).click();
    await responsePromise;

    // เปลี่ยนตัวกรองสถานะเป็น 'จ่ายแล้ว'
    const statusBtn = page.getByRole('combobox').nth(2);
    await statusBtn.click();
    
    responsePromise = page.waitForResponse(resp => resp.url().includes('status=paid'));
    await page.getByRole('option', { name: /จ่ายแล้ว|Paid/i }).click();
    await responsePromise;

    // ตรวจสอบว่ามีแต่รายการ 'จ่ายแล้ว' ในตาราง
    await expect(page.getByText(/รอจ่าย|Pending|To Pay/i)).not.toBeVisible();
    await expect(page.getByText(/จ่ายแล้ว|Paid/i).first()).toBeVisible();
  });

  test('ควรสามารถดูรายละเอียดและอนุมัติการจ่ายเงินได้', async ({ page }) => {
    // 1. เลือกพนักงาน PT-002 (Waree Thongdee)
    await page.getByRole('combobox').nth(1).click();
    await page.getByPlaceholder(/ค้นหา|Search|ป้อนชื่อพนักงาน/i).fill('PT-002');
    
    const responsePromise = page.waitForResponse(resp => resp.url().includes('/payouts/pt') && resp.status() === 200);
    await page.getByRole('option', { name: /PT-002/i }).click();
    await responsePromise;

    // 2. ค้นหารายการที่สถานะ 'รอจ่าย' และกดดูรายละเอียด
    await expect(page.getByText(/กำลังโหลด|Loading/i)).not.toBeVisible();
    
    const row = page.locator('tbody tr').filter({ hasText: /รอจ่าย|Pending|To Pay/i }).first();
    const viewBtn = row.locator('a').first();
    await viewBtn.click({ force: true });
    
    // ตรวจสอบหน้ารายละเอียด
    await expect(page.getByRole('heading', { name: /รายละเอียดการจ่าย|Payout Details/i })).toBeVisible({ timeout: 15000 });
    
    // 3. กดปุ่ม 'อนิุมัติการจ่ายเงิน'
    const approveBtn = page.getByRole('button', { name: /อนุมัติการจ่ายเงิน|Approve|Mark as Paid/i }).first();
    await approveBtn.click();
    
    // ยืนยันใน Dialog
    // ใช้ getByRole('button') โดยระบุ name ให้ชัดเจน และใช้ตัวสุดท้าย (ซึ่งมักจะเป็นใน Dialog ที่เพิ่งเปิดขึ้นมา)
    const confirmBtn = page.getByRole('button', { name: /อนุมัติการจ่ายเงิน|Approve|Mark as Paid/i }).last();
    await confirmBtn.click();
    
    // ตรวจสอบว่าสถานะเปลี่ยนเป็น 'จ่ายแล้ว'
    await expect(page.getByText(/จ่ายแล้ว|Paid/i).first()).toBeVisible({ timeout: 10000 });
  });
});
