// Production Next/Node smoke test. No Firebase credentials are used.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
const env = { ...process.env, NEXT_TELEMETRY_DISABLED: '1', SQL_HOST: '127.0.0.1', SQL_PORT: '1', SQL_USER: 'offline_test', SQL_DB_NAME: 'offline_test', SQL_PASSWORD: '' };
for (const key of ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY', 'GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_AUTH_EMULATOR_HOST']) delete env[key];
const port = 3178, origin = 'http://127.0.0.1:' + port;
const server = spawn('node', ['node_modules/next/dist/bin/next', 'start', '-p', String(port), '-H', '127.0.0.1'], { env, stdio: ['ignore', 'ignore', 'ignore'] });
try {
  let ready = false;
  for (let attempt = 0; attempt < 200; attempt++) {
    if (server.exitCode !== null) throw new Error('Production test server exited before readiness');
    try { await fetch(origin + '/api/products'); ready = true; break; }
    catch { await new Promise((resolve) => setTimeout(resolve, 100)); }
  }
  assert.ok(ready, 'Production server must start');
  const cases = [
    { path: '/api/auth/sync', options: { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uid: 'local-forged', email: 'victim@example.test' }) }, status: 401, code: 'CUSTOMER_AUTH_REQUIRED' },
    { path: '/api/auth/sync', options: { method: 'POST', headers: { Authorization: 'Bearer test-untrusted-token' } }, status: 503, code: 'CUSTOMER_AUTH_NOT_CONFIGURED' },
    { path: '/api/auth/sync', options: { method: 'POST', headers: { Authorization: 'Basic untrusted' } }, status: 401, code: 'CUSTOMER_AUTH_REQUIRED' },
    { path: '/api/orders?email=victim@example.test', options: {}, status: 401, code: 'CUSTOMER_AUTH_REQUIRED' },
  ];
  for (const entry of cases) {
    const response = await fetch(origin + entry.path, { ...entry.options, signal: AbortSignal.timeout(15000) });
    assert.equal(response.status, entry.status);
    assert.ok(response.headers.get('content-type').includes('application/json'));
    assert.ok(response.headers.get('cache-control').includes('no-store'));
    const body = await response.json(); assert.equal(body.code, entry.code);
    console.log('PASS: production HTTP ' + entry.path + ' -> JSON ' + entry.status + ' ' + entry.code);
  }
  const products = await (await fetch(origin + '/api/products')).json();
  assert.ok(products.products.length > 0);
  assert.equal((await fetch(origin + '/checkout?buyNow=1')).status, 200);
  console.log('PASS: guest catalogue and checkout render without Firebase credentials or an available database.');
} finally {
  server.kill('SIGTERM');
  await new Promise((resolve) => { if (server.exitCode !== null) return resolve(); server.once('exit', resolve); setTimeout(() => { server.kill('SIGKILL'); resolve(); }, 5000).unref(); });
}
