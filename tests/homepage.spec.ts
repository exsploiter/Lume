import { test, expect } from '@playwright/test';

test.describe('Homepage E2E Tests', () => {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    failedRequests.length = 0;
    
    page.on('console', (msg) => {
      const txt = msg.text();
      if (msg.type() === 'error') {
        consoleErrors.push(`[Console Error] ${txt}`);
      } else if (txt.toLowerCase().includes('hydration')) {
        consoleErrors.push(`[Hydration Mismatch] ${txt}`);
      }
    });

    page.on('pageerror', (err) => {
      consoleErrors.push(`[Uncaught Exception] ${err.stack || err.message}`);
    });

    page.on('requestfailed', (request) => {
      failedRequests.push(`[Request Failed] ${request.url()} - ${request.failure()?.errorText || 'Failed'}`);
    });

    await page.goto('/');
  });

  test.afterEach(async ({}, testInfo) => {
    if (consoleErrors.length > 0) {
      await testInfo.attach('console-errors', {
        body: consoleErrors.join('\n'),
        contentType: 'text/plain'
      });
    }
    if (failedRequests.length > 0) {
      await testInfo.attach('failed-requests', {
        body: failedRequests.join('\n'),
        contentType: 'text/plain'
      });
    }
  });

  test('should load the homepage and check content', async ({ page }) => {
    await expect(page).toHaveTitle(/DebtRadar/);
    
    const mainHeading = page.locator('h1');
    await expect(mainHeading).toContainText('Can This Software Be Trusted');

    const brandLink = page.locator('header a').first();
    await expect(brandLink).toBeVisible();
    await expect(brandLink).toContainText('DebtRadar');

    const input = page.locator('input[placeholder*="github.com"]');
    await expect(input).toBeVisible();
    
    const button = page.locator('button[type="submit"]');
    await expect(button).toBeVisible();
    await expect(button).toContainText('Analyze');
  });

  test('should allow toggling between Technical and Business view modes', async ({ page }) => {
    const techBtn = page.locator('button:has-text("Technical View")');
    const bizBtn = page.locator('button:has-text("Business View")');

    await expect(techBtn).toBeVisible();
    await expect(bizBtn).toBeVisible();

    await bizBtn.click();
    await expect(bizBtn).toHaveClass(/bg-/);

    await techBtn.click();
    await expect(techBtn).toHaveClass(/bg-/);
  });
});
