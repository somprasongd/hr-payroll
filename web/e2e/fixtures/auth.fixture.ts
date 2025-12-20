/**
 * Test user credentials loaded from environment variables
 */
export const testUsers = {
  admin: {
    username: process.env.TEST_ADMIN_USERNAME || 'admin',
    password: process.env.TEST_ADMIN_PASSWORD || 'changeme',
  },
  admin2: {
    username: 'admin2',
    password: 'changeme',
  },
  superadmin: {
    username: 'superadmin',
    password: 'changeme',
  },
  hr: {
    username: process.env.TEST_HR_USERNAME || 'test_hr',
    password: process.env.TEST_HR_PASSWORD || 'changeme',
  },
};

/**
 * API base URL for test setup/teardown
 */
export const apiBaseUrl = process.env.TEST_API_BASE_URL || 'http://localhost:8080/api/v1';
