// Run each mode in a fresh process so failing module-import doubles cannot
// contaminate the normal test suite: bun tests/auth-sync-cold-start.mjs <mode>.
import assert from 'node:assert/strict';
import { mock } from 'bun:test';
import { NextRequest } from 'next/server';
const mode = process.argv[2];
assert.ok(['verification-import', 'account-storage-import'].includes(mode));
const sensitive = 'TEST_ONLY_PRIVATE_KEY_TOKEN_AND_SQL_PASSWORD_DO_NOT_LOG';
// Set SQL_HOST so the sync route attempts database import
process.env.SQL_HOST = 'localhost';
if (mode === 'verification-import') {
  mock.module('../src/lib/customer-auth-server.ts', () => {
    throw Object.assign(new Error(sensitive), { code: 'ERR_MODULE_NOT_FOUND' });
  });
} else {
  mock.module('../src/lib/customer-auth-server.ts', () => ({
    requireCustomerIdentity: async () => ({ uid: 'test-verified-user', email: 'verified@example.test', name: 'Verified' }),
  }));
  mock.module('../src/db/index.ts', () => {
    throw Object.assign(new Error(sensitive), { code: 'ECONNREFUSED' });
  });
}
const messages = [];
const original = console.error;
console.error = (...args) => messages.push(args);
try {
  // The route itself must load even when an SDK or database dependency cannot.
  const { POST } = await import('../src/app/api/auth/sync/route.ts');
  const response = await POST(new NextRequest('http://localhost/api/auth/sync', { method: 'POST', headers: { Authorization: 'Bearer test-only-token' } }));
  assert.equal(response.status, 503);
  assert.ok(response.headers.get('content-type').includes('application/json'));
  assert.ok(response.headers.get('cache-control').includes('no-store'));
  const body = await response.json();
  assert.equal(body.code, mode === 'verification-import' ? 'CUSTOMER_AUTH_INITIALIZATION_FAILED' : 'CUSTOMER_ACCOUNT_UNAVAILABLE');
  assert.ok(!JSON.stringify(body).includes(sensitive));
  assert.ok(!JSON.stringify(messages).includes(sensitive));
  assert.ok(JSON.stringify(messages).includes(mode));
  assert.ok(JSON.stringify(messages).includes(mode === 'verification-import' ? 'ERR_MODULE_NOT_FOUND' : 'ECONNREFUSED'));
  console.log('PASS: '+mode+' failure returns structured JSON 503; safe stage/reason logged, no raw error or secret.');
} finally { console.error = original; mock.restore(); }
