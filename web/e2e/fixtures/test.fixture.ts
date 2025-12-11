import { test as base, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { testUsers } from './auth.fixture';

// Extend base test with custom fixtures
export const test = base.extend<{
  loginPage: LoginPage;
  adminCredentials: { username: string; password: string };
  hrCredentials: { username: string; password: string };
}>({
  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await use(loginPage);
  },
  
  adminCredentials: async ({}, use) => {
    await use(testUsers.admin);
  },
  
  hrCredentials: async ({}, use) => {
    await use(testUsers.hr);
  },
});

export { expect };
