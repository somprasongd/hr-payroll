import { test as base, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { testUsers } from './auth.fixture';

export type TestUserCredentials = {
  username: string;
  password: string;
};

// Extend base test with custom fixtures
export const test = base.extend<{
  loginPage: LoginPage;
  adminCredentials: { username: string; password: string };
  hrCredentials: { username: string; password: string };
}>({
  loginPage: async ({ page }, provide) => {
    const loginPage = new LoginPage(page);
    await provide(loginPage);
  },
  
  adminCredentials: async ({}, provide) => {
    await provide(testUsers.admin);
  },
  
  hrCredentials: async ({}, provide) => {
    await provide(testUsers.hr);
  },
});

export async function performFullLogin(
  loginPage: LoginPage,
  user: TestUserCredentials,
  company: string,
  branch: string,
) {
  await loginPage.goto();
  await loginPage.fullLogin(user.username, user.password, company, branch);
}

export { expect };
