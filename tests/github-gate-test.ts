import crypto from 'crypto';
import { verifyWebhookSignature, parseWebhookEvent } from '../lib/github-webhook';
import { evaluateCiGate } from '../lib/github-gate';
import type { AnalysisRecord } from '../types';

function runTests() {
  console.log('🧪 Starting GitHub Webhook & CI Gate Verification Tests...\n');

  // Test 1: HMAC Webhook Signature Verification
  console.log('Test 1: Webhook HMAC-SHA256 Signature Verification');
  const secret = 'super-secret-webhook-key-12345';
  const body = JSON.stringify({ test: 'payload', action: 'opened' });
  const validSignature = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');

  const isValid = verifyWebhookSignature(body, validSignature, secret);
  if (!isValid) throw new Error('Valid signature should pass verification');

  const tamperedBody = JSON.stringify({ test: 'payload', action: 'tampered' });
  const isInvalidTampered = verifyWebhookSignature(tamperedBody, validSignature, secret);
  if (isInvalidTampered) throw new Error('Tampered payload should be rejected');

  const invalidSignature = 'sha256=abcdef1234567890';
  const isInvalidSig = verifyWebhookSignature(body, invalidSignature, secret);
  if (isInvalidSig) throw new Error('Invalid signature format/hash should be rejected');

  console.log('  ✅ HMAC signature validation passed.\n');

  // Test 2: Webhook Event Payload Parsing
  console.log('Test 2: Webhook Push & PR Payload Parsing');
  const pushPayload = {
    ref: 'refs/heads/feature/auth-hardening',
    after: '8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b',
    before: '0000000000000000000000000000000000000000',
    pusher: { name: 'octocat' },
    repository: {
      name: 'lume-security',
      full_name: 'acme/lume-security',
      owner: { login: 'acme' },
      html_url: 'https://github.com/acme/lume-security',
      clone_url: 'https://github.com/acme/lume-security.git',
      default_branch: 'main',
      private: false,
    },
  };

  const parsedPush = parseWebhookEvent('push', pushPayload);
  if (!parsedPush) throw new Error('Push event parsing failed');
  if (parsedPush.owner !== 'acme' || parsedPush.repo !== 'lume-security' || parsedPush.branch !== 'feature/auth-hardening') {
    throw new Error('Push event extracted incorrect metadata: ' + JSON.stringify(parsedPush));
  }

  const prPayload = {
    action: 'opened',
    number: 42,
    pull_request: {
      id: 101,
      number: 42,
      title: 'Fix SQL injection in billing route',
      state: 'open',
      html_url: 'https://github.com/acme/lume-security/pull/42',
      head: {
        sha: '9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e',
        ref: 'fix/sql-injection',
      },
      base: {
        sha: '1111111111111111111111111111111111111111',
        ref: 'main',
      },
      user: {
        login: 'security-engineer',
      },
    },
    repository: {
      name: 'lume-security',
      full_name: 'acme/lume-security',
      owner: { login: 'acme' },
      html_url: 'https://github.com/acme/lume-security',
      default_branch: 'main',
    },
  };

  const parsedPR = parseWebhookEvent('pull_request', prPayload);
  if (!parsedPR) throw new Error('PR event parsing failed');
  if (parsedPR.prNumber !== 42 || parsedPR.commitSha !== '9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e') {
    throw new Error('PR event extracted incorrect metadata: ' + JSON.stringify(parsedPR));
  }

  console.log('  ✅ Push & PR payload extraction passed.\n');

  // Test 3: CI/CD Quality Gate Evaluation (Passed Scenario)
  console.log('Test 3: CI/CD Gate Evaluation (Passing Scenario)');
  const passingAnalysis: Partial<AnalysisRecord> = {
    id: 'test_analysis_pass',
    repo_owner: 'acme',
    repo_name: 'lume-security',
    repo_security_score: 92,
    collapse_score: 15,
    repo_exploitability_score: 12,
    critical_vulnerabilities: 0,
    security_collapse: false,
    avg_debt_score: 18,
    trustScore: 88,
    deploymentConfidence: 91,
    security_summary: {
      totalVulnerabilities: 2,
      critical: 0,
      high: 0,
      medium: 1,
      low: 1,
      score: 92,
      categoryCounts: {},
      owaspCategories: [],
      cweCategories: [],
      topFindings: [],
    },
  };

  const passResult = evaluateCiGate(passingAnalysis as AnalysisRecord, undefined, {
    owner: 'acme',
    repo: 'lume-security',
    commitSha: '9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e',
    prNumber: 42,
  });

  if (!passResult.passed || passResult.verdict !== 'PASSED' || passResult.state !== 'success') {
    throw new Error('Healthy repository should PASS the CI gate. Got: ' + JSON.stringify(passResult));
  }
  if (!passResult.markdownReport.includes('PASSED') || !passResult.markdownReport.includes('Trust Score')) {
    throw new Error('Markdown report missing key gate metrics');
  }

  console.log('  ✅ Gate evaluation (Passing scenario) passed.\n');

  // Test 4: CI/CD Quality Gate Evaluation (Failed Scenario with Critical Vuln)
  console.log('Test 4: CI/CD Gate Evaluation (Failing Scenario - Critical Vuln & Collapse)');
  const failingAnalysis: Partial<AnalysisRecord> = {
    id: 'test_analysis_fail',
    repo_owner: 'acme',
    repo_name: 'vulnerable-app',
    repo_security_score: 35,
    collapse_score: 82,
    repo_exploitability_score: 85,
    critical_vulnerabilities: 3,
    security_collapse: true,
    avg_debt_score: 75,
    trustScore: 28,
    deploymentConfidence: 30,
    security_summary: {
      totalVulnerabilities: 12,
      critical: 3,
      high: 4,
      medium: 3,
      low: 2,
      score: 35,
      categoryCounts: {},
      owaspCategories: ['A01:2021-Broken Access Control'],
      cweCategories: ['CWE-89'],
      topFindings: [
        {
          id: 'vuln_1',
          ruleId: 'sql_injection',
          title: 'Unsanitized SQL Query in User Lookup',
          description: 'Direct string concatenation in database query',
          severity: 'critical',
          filePath: 'server/db/users.ts',
          lineStart: 45,
          lineEnd: 48,
          evidence: 'SELECT * FROM users WHERE id = ' + "' + id + '",
          recommendation: 'Use parameterized queries',
          occurrenceCount: 1,
          exploitability: 90,
          owaspIds: ['A03:2021-Injection'],
          cweIds: ['CWE-89'],
          category: 'Injection',
        },
      ],
    },
  };

  const failResult = evaluateCiGate(failingAnalysis as AnalysisRecord, undefined, {
    owner: 'acme',
    repo: 'vulnerable-app',
    commitSha: '1111222233334444555566667777888899990000',
  });

  if (failResult.passed || failResult.verdict !== 'FAILED' || failResult.state !== 'failure') {
    throw new Error('Vulnerable repository should FAIL the CI gate. Got: ' + JSON.stringify(failResult));
  }
  if (failResult.reasons.length === 0) {
    throw new Error('Failing gate must provide clear reasons');
  }
  if (!failResult.markdownReport.includes('FAILED') || !failResult.markdownReport.includes('Unsanitized SQL Query')) {
    throw new Error('Markdown report missing critical finding details');
  }

  console.log('  ✅ Gate evaluation (Failing scenario) successfully caught vulnerabilities:');
  for (const reason of failResult.reasons) {
    console.log(`     - ❌ ${reason}`);
  }

  console.log('\n🎉 ALL GITHUB WEBHOOK & CI GATE TESTS PASSED SUCCESSFULLY!\n');
}

runTests();
