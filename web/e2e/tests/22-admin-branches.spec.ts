import { test, expect } from '../fixtures/test.fixture';
import { testUsers } from '../fixtures/auth.fixture';

test.describe('Admin Branches Management', () => {
    // Use a fresh context for each test in this file
    test.use({ storageState: { cookies: [], origins: [] } });

    const performFullLogin = async (loginPage: any, user: any, company: string, branch: string) => {
        await loginPage.goto();
        await loginPage.fullLogin(user.username, user.password, company, branch);
        await loginPage.page.waitForLoadState('networkidle');
    };

    test.beforeEach(async ({ loginPage }) => {
        await performFullLogin(loginPage, testUsers.admin, 'DEFAULT', 'สำนักงานใหญ่');
    });

    test('ควรแสดงหน้าการจัดการสาขาได้ถูกต้อง', async ({ page }) => {
        await page.goto('/th/admin/branches');
        await page.waitForLoadState('networkidle');

        // ตรวจสอบหัวข้อหน้า (ใช้กว้างๆ เพื่อรองรับภาษา)
        await expect(page.getByRole('heading', { name: /สาขา|Branch/i })).toBeVisible();

        // ตรวจสอบปุ่มสร้าง
        await expect(page.getByRole('button', { name: /สร้าง|เพิ่ม|Create/i })).toBeVisible();

        // ตรวจสอบตาราง และคอลัมน์พื้นฐาน
        const table = page.locator('table');
        await expect(table).toBeVisible();
        await expect(table.locator('thead')).toContainText(/รหัส|Code/i);
        await expect(table.locator('thead')).toContainText(/ชื่อ|Name/i);
    });

    test('ควรเปิด Dialog สร้างสาขาได้', async ({ page }) => {
        await page.goto('/th/admin/branches');
        await page.waitForLoadState('networkidle');

        await page.getByRole('button', { name: /สร้าง|เพิ่ม|Create/i }).click();

        // ตรวจสอบ Dialog
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await expect(dialog).toContainText(/สร้าง|Create/i);

        // ตรวจสอบฟิลด์ในฟอร์ม
        await expect(page.getByLabel(/รหัส|Code/i)).toBeVisible();
        await expect(page.getByLabel(/ชื่อ|Name/i)).toBeVisible();
        
        // กดยกเลิก
        await page.getByRole('button', { name: /ยกเลิก|Cancel/i }).click();
        await expect(dialog).not.toBeVisible();
    });
});
