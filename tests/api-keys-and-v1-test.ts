import {
  createApiKey,
  verifyAndGetApiKey,
  revokeApiKey,
  hashApiKey,
  generateRawApiKey,
} from '../lib/api-keys/key-store';
import { checkRateLimit, clearRateLimitStore } from '../lib/api-keys/rate-limiter';

async function runTests() {
  console.log('🧪 Running API Keys & Rate Limiting Test Suite...\n');
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

  // --- 1. Test Key Generation & Hashing ---
  console.log('--- Test 1: API Key Generation & SHA-256 Hashing ---');
  const { rawKey, prefix } = generateRawApiKey();
  assert(rawKey.startsWith('dr_live_'), `Raw key should start with 'dr_live_', got: ${rawKey}`);
  assert(prefix.startsWith('dr_live_') && prefix.endsWith('...'), `Prefix should be formatted with ellipsis, got: ${prefix}`);

  const hash1 = hashApiKey(rawKey);
  const hash2 = hashApiKey(rawKey);
  assert(hash1 === hash2 && hash1.length === 64, 'SHA-256 hash should be deterministic and 64 hex characters');

  // --- 2. Test API Key Creation & Verification ---
  console.log('\n--- Test 2: API Key Creation & Verification ---');
  const created = await createApiKey({ name: 'CI/CD Key', rateLimit: 30 });
  assert(created.key.startsWith('dr_live_'), 'Created key should start with dr_live_');
  assert(created.name === 'CI/CD Key', 'Name should match');
  assert(created.rateLimit === 30, 'Rate limit should match');

  const verified = await verifyAndGetApiKey(created.key);
  assert(verified.valid === true, 'Verification should succeed for valid key');
  assert(verified.apiKey?.id === created.id, 'Verified ID should match created ID');
  assert(verified.apiKey?.isActive === true, 'API key should be active');

  // --- 3. Test Invalid & Revoked Keys ---
  console.log('\n--- Test 3: Invalid Key Formats & Revocation ---');
  const badFormat = await verifyAndGetApiKey('invalid_key_123');
  assert(badFormat.valid === false, 'Bad format key should be rejected');

  const nonExistent = await verifyAndGetApiKey('dr_live_00000000000000000000000000000000');
  assert(nonExistent.valid === false, 'Non-existent key should be rejected');

  // Revoke key
  const revoked = await revokeApiKey(created.id);
  assert(revoked === true, 'Revocation should return true');

  const checkRevoked = await verifyAndGetApiKey(created.key);
  assert(checkRevoked.valid === false, 'Revoked key should be rejected on verification');

  // --- 4. Test Sliding-Window Rate Limiter ---
  console.log('\n--- Test 4: Sliding-Window Rate Limiter ---');
  clearRateLimitStore();
  const testId = 'test-client-1';
  const limit = 4;

  const r1 = checkRateLimit(testId, limit);
  assert(r1.allowed === true && r1.remaining === 3, 'Request 1 should be allowed with 3 remaining');

  const r2 = checkRateLimit(testId, limit);
  const r3 = checkRateLimit(testId, limit);
  const r4 = checkRateLimit(testId, limit);
  assert(r4.allowed === true && r4.remaining === 0, 'Request 4 should be allowed with 0 remaining');

  const r5 = checkRateLimit(testId, limit);
  assert(r5.allowed === false, 'Request 5 should be blocked by rate limiter');
  assert(r5.retryAfter !== undefined && r5.retryAfter > 0, `retryAfter should be > 0, got: ${r5.retryAfter}`);

  // Test distinct client bucket
  const otherClient = checkRateLimit('test-client-2', limit);
  assert(otherClient.allowed === true, 'Different client identifier should have independent bucket');

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
