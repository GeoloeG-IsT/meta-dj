import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Read from default .env file
dotenv.config();

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  // Global timeout for entire test run
  globalTimeout: process.env.CI ? 60 * 60 * 1000 : undefined,

  // Timeout for each test
  timeout: 60 * 1000, 

  expect: {
    timeout: 10 * 1000, 
  },

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173', // Vite default port
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    // Action timeout (click, fill, etc.)
    actionTimeout: 15 * 1000, 
    
    // Navigation timeout
    navigationTimeout: 30 * 1000,
  },

  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }], 
    ['junit', { outputFile: 'test-results/junit.xml' }], 
    ['list']
  ],

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    /* 
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    */
  ],

  // Run local dev server before starting the tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
