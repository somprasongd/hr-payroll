import { test, expect } from '../fixtures/test.fixture';
import { testUsers } from '../fixtures/auth.fixture';

test.describe('Admin Settings (Payroll Config)', () => {
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

    test('ควรแสดงหน้าการตั้งค่าเงินเดือนและแท็บต่างๆ ได้ถูกต้อง', async ({ page }) => {
        await page.goto('/th/admin/settings');
        await page.waitForLoadState('networkidle');

        // ตรวจสอบหัวข้อหน้า
        await expect(page.getByRole('heading', { name: /ตั้งค่า|Settings/i })).toBeVisible();

        // ตรวจสอบแท็บต่างๆ
        const tabList = page.getByRole('tablist');
        await expect(tabList).toBeVisible();
        
        // ตรวจสอบชื่อแท็บ (รองรับทั้งไทย/อังกฤษเบื้องต้น)
        await expect(tabList).toContainText(/อัตรา|Rates/i);
        await expect(tabList).toContainText(/สวัสดิการ|Bonuses/i);
        await expect(tabList).toContainText(/สาธารณูปโภค|Utilities/i);
        await expect(tabList).toContainText(/ประกันสังคม|Social/i);
        await expect(tabList).toContainText(/ภาษี|Tax/i);
    });

    test('ควรสลับแท็บและเห็นข้อมูลฟิลด์ที่เกี่ยวข้อง', async ({ page }) => {
        await page.goto('/th/admin/settings');
        await page.waitForLoadState('networkidle');

        // แท็บ อัตรา (Rates)
        await page.getByRole('tab', { name: /อัตรา|Rates/i }).click();
        await expect(page.getByLabel(/ชั่วโมง|Hourly/i).first()).toBeVisible();

        // แท็บ ประกันสังคม (Social Security)
        await page.getByRole('tab', { name: /ประกันสังคม|Social/i }).click();
        await expect(page.getByLabel(/อัตราหักลูกจ้าง|Employee Rate/i)).toBeVisible();
        await expect(page.getByLabel(/เพดาน|Wage Cap/i)).toBeVisible();

        // แท็บ ภาษี (Tax)
        await page.getByRole('tab', { name: /ภาษี|Tax/i }).click();
        await expect(page.getByText(/มาตรา 40\(1\)|Section 40\(1\)/i)).toBeVisible();
    });

    test('ควรเปิดดูประวัติการตั้งค่าได้', async ({ page }) => {
        await page.goto('/th/admin/settings');
        await page.waitForLoadState('networkidle');

        const historyBtn = page.getByRole('button', { name: /ประวัติ|History/i });
        await expect(historyBtn).toBeVisible();
        await historyBtn.click();

        // ตรวจสอบ Dialog ประวัติ
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await expect(dialog).toContainText(/ประวัติ|History/i);
        await expect(dialog.locator('table')).toBeVisible();
    });
});
