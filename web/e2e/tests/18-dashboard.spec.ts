import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/th/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test('ควรแสดงหน้า Dashboard ได้ถูกต้อง', async ({ page }) => {
    // Check page heading
    await expect(page.getByRole('heading', { name: /แดชบอร์ด|dashboard/i })).toBeVisible();
  });

  test('ควรมี Employee Stats Widget', async ({ page }) => {
    // Employee stats widget should show employee statistics
    const statsSection = page.locator('[class*="grid"]').filter({ hasText: /พนักงาน|employee/i }).first();
    await expect(statsSection).toBeVisible();
  });

  test('ควรมี Attendance Chart Widget', async ({ page }) => {
    // Attendance chart widget
    const attendanceWidget = page.getByText(/สถิติการมาทำงาน|attendance/i).first();
    await expect(attendanceWidget).toBeVisible();
  });

  test('ควรมี Payroll Summary Widget', async ({ page }) => {
    // Payroll summary widget
    const payrollWidget = page.getByText(/สรุปเงินเดือน|payroll/i).first();
    await expect(payrollWidget).toBeVisible();
  });

  test('ควรมี Pending Items Widget', async ({ page }) => {
    // Pending items widget
    const pendingWidget = page.getByText(/รายการรอดำเนินการ|pending/i).first();
    await expect(pendingWidget).toBeVisible();
  });

  test('ควรมี Expiring Documents Widget', async ({ page }) => {
    // Expiring documents widget
    const docsWidget = page.getByText(/เอกสารใกล้หมดอายุ|expiring/i).first();
    await expect(docsWidget).toBeVisible();
  });

  test('ควรมี Latest Activity Widget (admin only)', async ({ page }) => {
    // Latest activity widget - visible only for admin users
    // Uses "ประวัติการใช้งาน" as title from translations
    const activityWidget = page.getByText(/ประวัติการใช้งาน/i).first();
    await expect(activityWidget).toBeVisible();
  });

  test('ควรมี Sidebar navigation', async ({ page }) => {
    // Sidebar should be visible with navigation links
    const sidebar = page.locator('[data-sidebar="sidebar"]').or(page.locator('aside'));
    await expect(sidebar).toBeVisible();
  });
});
