import { test, expect } from '../fixtures/test.fixture';
import { testUsers } from '../fixtures/auth.fixture';

test.describe('Admin Document Types Management', () => {
  // Use a fresh context for each test in this file
  test.use({ storageState: { cookies: [], origins: [] } });

  const performFullLogin = async (loginPage: any, user: any, company: string, branch: string) => {
    await loginPage.goto();
    await loginPage.fullLogin(user.username, user.password, company, branch);
    await loginPage.page.waitForLoadState('networkidle');
  };

  test('Admin ควรเห็นทั้ง System Document Types และของบริษัทตัวเอง (DEFAULT)', async ({ page, loginPage }) => {
    await performFullLogin(loginPage, testUsers.admin, 'DEFAULT', 'สำนักงานใหญ่');

    await page.goto('/th/admin/document-types');
    await page.waitForLoadState('networkidle');

    // 1. ควรเห็น System Types (Passport, Visa)
    await expect(page.getByText(/Passport/i).first()).toBeVisible();
    await expect(page.getByText(/Visa/i).first()).toBeVisible();

    // 2. ควรเห็น Company Types ของตัวเอง (Social Security Card, Driving License)
    await expect(page.getByText(/Social Security Card|บัตรประกันสังคม/i).first()).toBeVisible();
    await expect(page.getByText(/Driving License|ใบขับขี่/i).first()).toBeVisible();

    // 3. ไม่ควรเห็น Company Types ของบริษัทอื่น (Diploma, Work Permit Foreign Staff)
    await expect(page.getByRole('cell', { name: /วุฒิการศึกษา|Diploma/i })).not.toBeVisible();
  });

  test('Admin ของ COMPANY2 ควรเห็น System Document Types และของ COMPANY2 เอง', async ({ page, loginPage }) => {
    await performFullLogin(loginPage, testUsers.admin2, 'COMPANY2', 'สำนักงานใหญ่');

    await page.goto('/th/admin/document-types');
    await page.waitForLoadState('networkidle');

    // 1. ควรเห็น System Types
    await expect(page.getByText(/Passport/i).first()).toBeVisible();

    // 2. ควรเห็น Company Types ของ COMPANY2
    await expect(page.getByText(/Diploma|วุฒิการศึกษา/i).first()).toBeVisible();
    await expect(page.getByText(/Work Permit \(Foreign Staff\)|ใบอนุญาตทำงาน \(พนักงานต่างชาติ\)/i).first()).toBeVisible();

    // 3. ไม่ควรเห็น Company Types ของ DEFAULT
    await expect(page.getByRole('cell', { name: /บัตรประกันสังคม|Social Security Card/i })).not.toBeVisible();
  });
});
