import { GOLDEN_SUITE } from './fixtures';
import { detectSecurityFindings } from '../../lib/security/detector';

interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  positivePassed: boolean;
  negativePassed: boolean;
  details: string;
}

export function runGoldenSuite(): boolean {
  console.log('===============================================================');
  console.log('🛡️  DEBTRADAR GOLDEN DETECTOR REGRESSION SUITE');
  console.log('===============================================================\n');

  let passedCount = 0;
  let totalCount = GOLDEN_SUITE.length;
  const results: TestResult[] = [];

  for (const testCase of GOLDEN_SUITE) {
    // 1. Evaluate True Positive: MUST flag finding
    const posFindings = detectSecurityFindings(testCase.positiveFile);
    const positiveMatched = posFindings.some(
      (f) => f.ruleId === testCase.expectedRuleId || f.category === testCase.category
    );

    // 2. Evaluate True Negative: MUST NOT flag finding (Zero False Positives)
    const negFindings = detectSecurityFindings(testCase.negativeFile);
    const negativeSafe = negFindings.length === 0 || !negFindings.some((f) => f.category === testCase.category);

    const testPassed = positiveMatched && negativeSafe;
    if (testPassed) {
      passedCount++;
    }

    const result: TestResult = {
      id: testCase.id,
      name: testCase.name,
      passed: testPassed,
      positivePassed: positiveMatched,
      negativePassed: negativeSafe,
      details: testPassed
        ? `[OK] True Positive detected (${posFindings.length} findings), True Negative cleanly suppressed.`
        : `[FAIL] Pos: ${positiveMatched ? 'PASS' : 'MISSED'}, Neg: ${negativeSafe ? 'CLEAN' : 'FALSE POSITIVE (' + negFindings.length + ')'}`,
    };
    results.push(result);

    const statusIcon = testPassed ? '✅' : '❌';
    console.log(`${statusIcon} [${testCase.id}] ${testCase.name}`);
    console.log(`   ${result.details}`);
  }

  const successRate = ((passedCount / totalCount) * 100).toFixed(1);
  console.log('\n---------------------------------------------------------------');
  console.log(`📊 Suite Results: ${passedCount}/${totalCount} Passed (${successRate}%)`);
  console.log('---------------------------------------------------------------\n');

  if (passedCount === totalCount) {
    console.log('✨ All detector golden regression tests passed with zero regressions.');
    return true;
  } else {
    console.error('💥 Regression test suite failed. Review failures above.');
    return false;
  }
}

// Allow direct execution
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('run-golden-suite.ts')) {
  const success = runGoldenSuite();
  if (!success) {
    process.exit(1);
  }
}
