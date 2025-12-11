import { test, expect } from '@playwright/test';
import { WorklogsFTPage } from '../pages/worklogs-ft.page';
import { WorklogsPTPage } from '../pages/worklogs-pt.page';

test.describe('Worklogs', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });

  test.describe('Full-Time Worklogs', () => {
    let ftPage: WorklogsFTPage;

    test.beforeEach(async ({ page }) => {
      ftPage = new WorklogsFTPage(page);
      await ftPage.goto();
    });

    test('ควรแสดงหน้า FT Worklogs ได้ถูกต้อง', async () => {
      await expect(ftPage.pageHeading).toBeVisible();
      await expect(ftPage.createButton).toBeVisible();
      await expect(ftPage.worklogsTable).toBeVisible();
    });

    test('ควรมี Filter ประเภท Type ได้', async () => {
      await expect(ftPage.typeFilter).toBeVisible();
    });

    test('ควรมี Filter สถานะได้', async () => {
      await expect(ftPage.statusFilter).toBeVisible();
    });

    test('ควรมีปุ่มล้างตัวกรองได้', async () => {
      await expect(ftPage.clearFilterButton).toBeVisible();
    });
  });

  test.describe('Part-Time Worklogs', () => {
    let ptPage: WorklogsPTPage;

    test.beforeEach(async ({ page }) => {
      ptPage = new WorklogsPTPage(page);
      await ptPage.goto();
    });

    test('ควรแสดงหน้า PT Worklogs ได้ถูกต้อง', async () => {
      await expect(ptPage.pageHeading).toBeVisible();
      await expect(ptPage.createButton).toBeVisible();
      await expect(ptPage.worklogsTable).toBeVisible();
    });

    test('ควรมี Employee selector ได้', async () => {
      await expect(ptPage.employeeCombobox).toBeVisible();
    });

    test('ควรมี Filter สถานะได้', async () => {
      await expect(ptPage.statusFilter).toBeVisible();
    });

    test('ควรมีปุ่มล้างตัวกรองได้', async () => {
      await expect(ptPage.clearFilterButton).toBeVisible();
    });
  });
});
