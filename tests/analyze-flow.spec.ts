import { test, expect } from '@playwright/test';

test.describe('Analyze Flow and Heatmap E2E Tests', () => {
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

    // Mock/Intercept create-pr calls to remain safe and deterministic during testing
    await page.route('**/api/create-pr', async (route) => {
      const payload = JSON.parse(route.request().postData() || '{}');
      if (payload.preview) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            originalSnippet: "const data = eval(body);",
            fixedSnippet: "const data = JSON.parse(body);",
            explanation: "Replaced unsafe dynamic code evaluation (eval) with JSON.parse to prevent injection vulnerability.",
            estimatedDebtReduction: 35
          })
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            prUrl: "https://github.com/OWASP/NodeGoat/pull/42",
            prNumber: 42,
            estimatedDebtReduction: 35,
            message: "Pull request successfully generated!"
          })
        });
      }
    });

    // Mock explain calls to avoid rate limits or AI failures
    await page.route('**/api/explain', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          explanation: "This module uses eval() which poses severe remote code execution security risk. Refactoring to standard JSON.parse is highly recommended."
        })
      });
    });

    // Mock analyze submission call to return a mock analysis ID
    await page.route('**/api/analyze', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          analysisId: 'mock-analysis-id',
          status: 'pending'
        })
      });
    });

    // Mock analysis status and data endpoint
    await page.route(/\/api\/analysis\/mock-analysis-id(\?.*)?/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          analysis: {
            id: 'mock-analysis-id',
            repo_owner: 'OWASP',
            repo_name: 'NodeGoat',
            repo_url: 'https://github.com/OWASP/NodeGoat',
            status: 'complete',
            progress: 100,
            repo_security_score: 45,
            collapse_score: 30,
            repo_exploitability_score: 60,
            critical_vulnerabilities: 1,
            trustScore: 75,
            deploymentConfidence: 80,
            fingerprint_label: 'weak-cryptography',
            fingerprint_confidence: 0.9,
            total_nodes: 1,
            avg_debt_score: 65
          },
          nodes: [
            {
              id: 'node-1',
              analysis_id: 'mock-analysis-id',
              file_path: 'test/security/profile-test.js',
              symbol_name: 'statustest/security/',
              node_type: 'function',
              line_start: 10,
              line_end: 20,
              debt_score: 65,
              security_score: 80,
              security_weighted_score: 85,
              has_critical_security: true,
              vulnerability_count: 1,
              security_risk_level: 'critical',
              exploitability_score: 80,
              collapse_risk: 30,
              autofix_available: true,
              complexity: 12,
              duplication_score: 0.1,
              blast_radius: 5,
              owasp_categories: ['A03:2021-Injection'],
              cwe_categories: ['CWE-89'],
              attack_surface_score: 45,
              propagation_risk: 20,
              public_exposure: true,
              security_findings: [
                {
                  id: 'finding-1',
                  ruleId: 'unsafe-eval',
                  title: 'Unsafe eval usage',
                  description: 'Evaluation of string as code is insecure.',
                  severity: 'critical',
                  filePath: 'test/security/profile-test.js',
                  lineStart: 15,
                  lineEnd: 15,
                  evidence: 'eval(userInput)',
                  recommendation: 'Use JSON.parse',
                  occurrenceCount: 1,
                  exploitability: 0.9,
                  owaspIds: ['A03'],
                  cweIds: ['CWE-89'],
                  category: 'Injection'
                }
              ],
              dependencies: [],
              dependents: [],
              fingerprint_tag: 'weak-cryptography'
            }
          ],
          links: [],
          executiveSummary: 'Mock executive summary explanation.',
          deploymentConfidence: { deploymentConfidence: 80, deploymentRecommendation: 'Proceed with caution' },
          trustScore: { trustScore: 75 },
          businessRisks: ['Low'],
          operationalRisks: ['Low'],
          customerImpact: ['None'],
          ignoreConsequences: ['Minor consequences'],
          consequenceForecast: { shortTermImpact: 'Minor', longTermImpact: 'Negligible' }
        })
      });
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

  test('should analyze repository, render heatmap, select node and verify sidebar + AutoFix PR modal', async ({ page }) => {
    const input = page.locator('input[placeholder*="github.com"]');
    await input.fill('OWASP/NodeGoat');
    
    const analyzeBtn = page.locator('button[type="submit"]');
    await analyzeBtn.click();

    await page.waitForURL(/\/analyze\/.+/, { timeout: 15000 });
    
    const svgSelector = '.graph-container svg';
    await page.waitForSelector(svgSelector, { timeout: 60000 });
    await expect(page.locator(svgSelector)).toBeVisible();

    const firstNode = page.locator('.graph-container svg circle').first();
    await expect(firstNode).toBeVisible();
    await firstNode.click({ force: true });

    const sidebar = page.locator('.hidden.lg\\:block .glass-panel').filter({ hasText: 'Technical Debt Score' });
    await expect(sidebar).toBeVisible();

    const explainBtn = sidebar.locator('button:has-text("Technical AI Explain")');
    await expect(explainBtn).toBeVisible();
    await explainBtn.click();
    
    const insightsHeader = sidebar.locator('span:has-text("Technical Insights")');
    await expect(insightsHeader).toBeVisible({ timeout: 10000 });

    const fixPRBtn = sidebar.locator('button:has-text("Generate Fix PR")');
    await expect(fixPRBtn).toBeVisible();
    await fixPRBtn.click();

    const modalHeader = sidebar.locator('h3:has-text("AutoFix Code Patch")');
    await expect(modalHeader).toBeVisible();

    const diffLines = sidebar.locator('.overflow-x-auto table tbody tr');
    await expect(diffLines.first()).toBeVisible();

    const confirmBtn = sidebar.locator('button:has-text("Confirm & Open PR")');
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    const successHeader = sidebar.locator('h4:has-text("PR Opened Successfully!")');
    await expect(successHeader).toBeVisible();

    const prLink = sidebar.locator('a:has-text("View Pull Request")');
    await expect(prLink).toBeVisible();
    await expect(prLink).toHaveAttribute('href', 'https://github.com/OWASP/NodeGoat/pull/42');
  });
});
