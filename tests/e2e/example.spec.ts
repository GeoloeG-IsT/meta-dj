import { test, expect } from '../support/fixtures';

test.describe('Example Test Suite', () => {
  test('should load homepage', async ({ page }) => {
    await page.goto('/');
    // Vite default title usually contains "Vite" or project name
    await expect(page).toHaveTitle(/Vite|meta-dj/i);
  });
});
