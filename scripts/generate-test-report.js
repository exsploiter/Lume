const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Target directory and paths
const reportDir = path.join(__dirname, '..', 'playwright-report');
const resultsPath = path.join(reportDir, 'results.json');
const mdReportPath = path.join(reportDir, 'debugging-report.md');

console.log('🚀 Running Playwright automated browser tests in JSON mode...');

// Ensure report dir exists
if (!fs.existsSync(reportDir)) {
  fs.mkdirSync(reportDir, { recursive: true });
}

// Execute playwright tests
let testsFailed = false;
try {
  // We run playwright test to generate reports based on playwright.config.ts settings
  execSync('npx playwright test', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  console.log('✅ Playwright tests completed successfully.');
} catch (error) {
  console.log('⚠️ Playwright tests finished with some failures (which is expected during bug detection).');
  testsFailed = true;
}

// Check if results.json exists
if (!fs.existsSync(resultsPath)) {
  console.error('❌ Error: Playwright results.json was not found at ' + resultsPath);
  process.exit(1);
}

// Parse Playwright json results
const resultsData = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));

const totalTests = resultsData.stats.expected || 0;
const passedTests = resultsData.stats.expected - (resultsData.stats.unexpected || 0);
const failedTests = resultsData.stats.unexpected || 0;
const durationMs = resultsData.stats.duration || 0;

let mdReport = `# 🕵️ Playwright Automated Bug & Interaction Testing Report

This report summarizes the browser-based automated testing execution, classifying all caught runtime exceptions, console errors, failed API endpoints, hydration warnings, and visual component crashes.

## 📊 Summary

* **Execution Status**: ${failedTests > 0 ? '🔴 FAILED TESTS DETECTED' : '🟢 ALL TESTS PASSED'}
* **Total Tests Run**: ${totalTests + failedTests}
* **Passed**: ${passedTests}
* **Failed / Unexpected**: ${failedTests}
* **Duration**: ${(durationMs / 1000).toFixed(2)} seconds
* **Generated At**: ${new Date().toLocaleString()}

---

`;

// Parse failed cases and collected logs
const bugsDetected = [];

function searchSpecs(suite) {
  if (suite.specs) {
    for (const spec of suite.specs) {
      if (spec.tests) {
        for (const test of spec.tests) {
          const isFailed = test.results && test.results.some(r => r.status === 'unexpected' || r.status === 'fail');
          
          // Get errors, console-errors and failed-requests attachments
          let errors = [];
          let consoleErrors = '';
          let failedRequests = '';
          
          if (test.results) {
            for (const res of test.results) {
              if (res.error) {
                errors.push(res.error.stack || res.error.message);
              }
              if (res.errors) {
                for (const err of res.errors) {
                  errors.push(err.stack || err.message);
                }
              }
              if (res.attachments) {
                for (const attach of res.attachments) {
                  if (attach.name === 'console-errors' && attach.body) {
                    try {
                      const decoded = Buffer.from(attach.body, 'base64').toString('utf8');
                      consoleErrors += decoded + '\n';
                    } catch (e) {
                      consoleErrors += attach.body + '\n';
                    }
                  }
                  if (attach.name === 'failed-requests' && attach.body) {
                    try {
                      const decoded = Buffer.from(attach.body, 'base64').toString('utf8');
                      failedRequests += decoded + '\n';
                    } catch (e) {
                      failedRequests += attach.body + '\n';
                    }
                  }
                }
              }
            }
          }

          if (isFailed || consoleErrors || failedRequests) {
            bugsDetected.push({
              title: spec.title,
              file: spec.file,
              line: spec.line,
              isFailed,
              errors,
              consoleErrors: consoleErrors.trim(),
              failedRequests: failedRequests.trim()
            });
          }
        }
      }
    }
  }
  if (suite.suites) {
    for (const subSuite of suite.suites) {
      searchSpecs(subSuite);
    }
  }
}

if (resultsData.suites) {
  for (const suite of resultsData.suites) {
    searchSpecs(suite);
  }
}

if (bugsDetected.length === 0) {
  mdReport += `## 🎉 No Website Bugs or Console Errors Detected!
The application loaded, navigated, and completed all API/AutoFix integration flows without throwing any console errors, uncaught exceptions, network failures, or react warnings.
`;
} else {
  mdReport += `## ❌ Detected Browser Exceptions & Interaction Failures

`;

  bugsDetected.forEach((bug, index) => {
    mdReport += `### Issue ${index + 1}: ${bug.title}
* **Test File**: \`${bug.file}:${bug.line}\`
* **Status**: ${bug.isFailed ? '💥 Test Failure' : '⚠️ Warning (Passed but with console warnings)'}

`;

    if (bug.errors.length > 0) {
      mdReport += `#### Error Stack Trace:
\`\`\`text
${bug.errors.join('\n\n')}
\`\`\`
`;
    }

    if (bug.consoleErrors) {
      mdReport += `#### Browser Console Outputs:
\`\`\`text
${bug.consoleErrors}
\`\`\`
`;
    }

    if (bug.failedRequests) {
      mdReport += `#### Failed Network Requests:
\`\`\`text
${bug.failedRequests}
\`\`\`
`;
    }

    // Determine possible root cause and fix recommendation
    let classification = "Unknown Bug";
    let rootCause = "The browser testing assertion failed or timed out.";
    let affectedFiles = "Unknown";
    let recommendation = "Verify locator targets and server connectivity.";
    let severity = "Medium";

    const allErrorsText = (bug.errors.join('\n') + '\n' + bug.consoleErrors + '\n' + bug.failedRequests).toLowerCase();

    if (allErrorsText.includes('hydration')) {
      classification = "React Hydration Mismatch";
      rootCause = "HTML rendered on the server did not match the initial client-side HTML structure. This is often caused by conditional formatting based on window/browser properties (e.g. checking window width or document layout in render rather than in useEffect), or invalid nesting of tags (e.g. nested paragraph or table tags).";
      affectedFiles = "app/layout.tsx or page components";
      recommendation = "Use 'useEffect' to set browser-only variables in state after hydration, or suppress hydration warnings on components using 'suppressHydrationWarning'.";
      severity = "Medium";
    } else if (allErrorsText.includes('500') || allErrorsText.includes('internal server error')) {
      classification = "API Server Endpoint Crash (500)";
      rootCause = "The server route failed to handle the incoming request payload or crashed when interacting with Supabase / GitHub API.";
      affectedFiles = "app/api/**/*.ts";
      recommendation = "Wrap the api endpoint code block inside a robust try-catch, and return a clean 500 JSON response detailing the missing fields or database connection issues rather than crashing the Next.js process.";
      severity = "Critical";
    } else if (allErrorsText.includes('d3') || allErrorsText.includes('svg') || allErrorsText.includes('heatmap')) {
      classification = "D3 Heatmap Rendering Error";
      rootCause = "The SVG container or elements failed to initialize, or the data passed to the simulation forces was empty/undefined.";
      affectedFiles = "components/HeatMap.tsx";
      recommendation = "Ensure node and link data props are properly validated (e.g., fallback empty array check before binding D3 simulation).";
      severity = "High";
    } else if (allErrorsText.includes('timeout') || allErrorsText.includes('waiting for')) {
      classification = "Async Timeout / Hanging Load State";
      rootCause = "The test locator timed out waiting for a specific button or element to become visible, indicating a hanging loading screen or infinite spinner.";
      affectedFiles = "app/analyze/[id]/AnalyzeClient.tsx";
      recommendation = "Improve error states so that if loading fails or Supabase polling yields 'failed', an error banner renders instantly instead of spinning indefinitely.";
      severity = "High";
    }

    mdReport += `#### 💡 Automated Diagnostic Report
* **Classification**: ${classification}
* **Severity**: ${severity}
* **Likely Root Cause**: ${rootCause}
* **Affected Files**: \`${affectedFiles}\`
* **Suggested Fix**:
  ${recommendation}

---

`;
  });
}

// Write the markdown report file
fs.writeFileSync(mdReportPath, mdReport, 'utf8');

console.log('\n==================================================');
console.log('📊 playright-report/debugging-report.md generated!');
console.log(`- Total Tests: ${totalTests + failedTests}`);
console.log(`- Passed: ${passedTests}`);
console.log(`- Failed: ${failedTests}`);
console.log('==================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
