import { seedDemoPreset, DEMO_PRESETS } from '../lib/demo/demo-presets';
import { getAnalysis, getDebtNodes } from '../lib/supabase/server';
import { calculateTrustScore } from '../lib/business-intelligence/trust-score';
import { evaluateComprehensiveCompliance } from '../lib/business-intelligence/compliance-matrix';

async function runTests() {
  console.log('🧪 Running Demo Presets & Walkthrough Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: unknown, msg: string) {
    if (Boolean(condition)) {
      console.log(`  ✅ ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${msg}`);
      failed++;
    }
  }

  assert(DEMO_PRESETS.length === 3, 'Should have 3 defined demo presets');

  // --- 1. Test FinTech Core Banking Preset ---
  console.log('\n--- Test 1: FinTech Core Banking Demo Preset ---');
  const fintechId = await seedDemoPreset('fintech-core-banking');
  assert(fintechId === 'demo-fintech-core-banking', 'Should return demo-fintech-core-banking ID');

  const fintechAnalysis = await getAnalysis(fintechId);
  assert(fintechAnalysis !== null, 'Seeded FinTech analysis should be readable from store');
  assert(fintechAnalysis?.critical_vulnerabilities === 3, 'Should have 3 critical vulnerabilities');
  assert(fintechAnalysis?.trustScore === 34, `Trust score should be 34, got: ${fintechAnalysis?.trustScore}`);
  assert(fintechAnalysis?.security_collapse === true, 'Security collapse should be true');

  const fintechNodes = await getDebtNodes(fintechId);
  assert(fintechNodes.length > 0, `Should seed debt nodes, got: ${fintechNodes.length}`);
  const secNode = fintechNodes.find((n) => n.file_path === 'src/config/aws.ts');
  assert(secNode !== undefined && secNode.has_critical_security === true, 'AWS config node should have critical security flag');

  // Test compliance evaluation on seeded demo
  const fintechCompliance = evaluateComprehensiveCompliance({ analysis: fintechAnalysis!, nodes: fintechNodes });
  assert(fintechCompliance.frameworks.SOC2.status === 'NON_COMPLIANT', 'FinTech demo should fail SOC 2');
  assert(fintechCompliance.criticalGaps.length > 0, 'FinTech demo should have critical gaps');

  // --- 2. Test Cloud-Native SaaS Preset ---
  console.log('\n--- Test 2: Cloud-Native SaaS Demo Preset ---');
  const saasId = await seedDemoPreset('cloud-native-saas');
  assert(saasId === 'demo-cloud-native-saas', 'Should return demo-cloud-native-saas ID');

  const saasAnalysis = await getAnalysis(saasId);
  assert(saasAnalysis !== null, 'Seeded SaaS analysis should be readable');
  assert(saasAnalysis?.trustScore === 74, `Trust score should be 74, got: ${saasAnalysis?.trustScore}`);
  assert(saasAnalysis?.deploymentRecommendation === 'NEEDS REVIEW', 'Recommendation should be NEEDS REVIEW');

  // --- 3. Test Enterprise IDP Gateway Preset ---
  console.log('\n--- Test 3: Enterprise IDP Gateway Demo Preset ---');
  const idpId = await seedDemoPreset('enterprise-idp-gateway');
  assert(idpId === 'demo-enterprise-idp-gateway', 'Should return demo-enterprise-idp-gateway ID');

  const idpAnalysis = await getAnalysis(idpId);
  assert(idpAnalysis !== null, 'Seeded IDP analysis should be readable');
  assert(idpAnalysis?.trustScore === 94, `Trust score should be 94, got: ${idpAnalysis?.trustScore}`);
  assert(idpAnalysis?.critical_vulnerabilities === 0, 'Critical vulnerabilities should be 0');
  assert(idpAnalysis?.deploymentRecommendation === 'SAFE TO SHIP', 'Recommendation should be SAFE TO SHIP');

  const idpNodes = await getDebtNodes(idpId);
  const idpCompliance = evaluateComprehensiveCompliance({ analysis: idpAnalysis!, nodes: idpNodes });
  assert(idpCompliance.frameworks.SOC2.status === 'AUDIT_READY', 'IDP demo should be AUDIT_READY for SOC 2');
  assert(idpCompliance.overallReadinessScore >= 90, `IDP overall readiness should be >= 90, got: ${idpCompliance.overallReadinessScore}`);

  console.log(`\n========================================`);
  console.log(`Test Results: ${passed} passed, ${failed} failed.`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
