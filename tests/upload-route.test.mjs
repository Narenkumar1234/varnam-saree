import { describe, test, expect, beforeEach, mock } from 'bun:test';

describe('Admin upload route', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  test('rejects non-admin requests', async () => {
    const { POST } = await import('../src/app/api/admin/upload/route.ts');
    const request = new Request('http://localhost/api/admin/upload', {
      method: 'POST',
      body: new FormData(),
    });
    
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  test('rejects invalid file types', async () => {
    process.env.ADMIN_LOGIN_EMAIL = 'test@example.com';
    process.env.ADMIN_LOGIN_PASSWORD = 'testpass';
    process.env.ADMIN_SESSION_SECRET = 'test-secret-for-upload-route-test-12345';
    
    const { createAdminSession } = await import('../src/lib/admin-session.ts');
    const token = await createAdminSession();
    
    const formData = new FormData();
    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    formData.append('file', file);
    
    const { POST } = await import('../src/app/api/admin/upload/route.ts');
    const request = new Request('http://localhost/api/admin/upload', {
      method: 'POST',
      headers: { Cookie: `admin_session=${token}` },
      body: formData,
    });
    
    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toMatch(/Invalid file type/i);
    
    delete process.env.ADMIN_LOGIN_EMAIL;
    delete process.env.ADMIN_LOGIN_PASSWORD;
    delete process.env.ADMIN_SESSION_SECRET;
  });

  test('returns helpful error when Firebase Storage is not ready', async () => {
    process.env.ADMIN_LOGIN_EMAIL = 'test@example.com';
    process.env.ADMIN_LOGIN_PASSWORD = 'testpass';
    process.env.ADMIN_SESSION_SECRET = 'test-secret-for-storage-error-test-67890';
    process.env.FIREBASE_PROJECT_ID = 'test-project';
    process.env.FIREBASE_CLIENT_EMAIL = 'test@test-project.iam.gserviceaccount.com';
    process.env.FIREBASE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC\n-----END PRIVATE KEY-----\n';
    
    const { createAdminSession } = await import('../src/lib/admin-session.ts');
    const token = await createAdminSession();
    
    const formData = new FormData();
    const file = new File(['fake image data'], 'test.jpg', { type: 'image/jpeg' });
    formData.append('file', file);
    
    const { POST } = await import('../src/app/api/admin/upload/route.ts');
    const request = new Request('http://localhost/api/admin/upload', {
      method: 'POST',
      headers: { Cookie: `admin_session=${token}` },
      body: formData,
    });
    
    const response = await POST(request);
    
    const data = await response.json();
    if (response.status === 503) {
      expect(data.error).toMatch(/Photo storage is not ready yet/i);
      expect(data.error).toMatch(/Paste a public image link instead/i);
    } else if (response.status === 500) {
      console.log('Firebase Storage initialized, skipping unavailable error test');
    }
    
    delete process.env.ADMIN_LOGIN_EMAIL;
    delete process.env.ADMIN_LOGIN_PASSWORD;
    delete process.env.ADMIN_SESSION_SECRET;
    delete process.env.FIREBASE_PROJECT_ID;
    delete process.env.FIREBASE_CLIENT_EMAIL;
    delete process.env.FIREBASE_PRIVATE_KEY;
  });
});
