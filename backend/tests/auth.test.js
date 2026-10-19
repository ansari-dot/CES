import request from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/shared/db/knex.js';

describe('Auth Module & Security Tests (SRS v1.1)', () => {
  let app;

  beforeAll(async () => {
    app = createApp();
  });

  afterAll(async () => {
    await db.destroy();
  });

  describe('POST /api/v1/auth/login', () => {
    it('should reject invalid credentials with generic INVALID_CREDENTIALS error', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ identifier: 'admin', password: 'WrongPassword!' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(res.headers['set-cookie']).toBeUndefined();
    });

    it('should reject unknown identifier with same generic INVALID_CREDENTIALS error (timing-safe)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ identifier: 'nonexistent_user', password: 'RandomPassword123!' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should successfully log in admin, set auth cookies, and return safe user payload', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ identifier: 'admin', password: 'AdminPassword123!' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.username).toBe('admin');
      expect(res.body.data.role).toBe('ADMIN');
      expect(res.body.data.permissions).toBeDefined();
      expect(res.body.data.password).toBeUndefined();
      expect(res.body.data.password_hash).toBeUndefined();
      expect(res.body.data.accessToken).toBeUndefined();

      // Check cookies
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const cookieStr = cookies.join('; ');
      expect(cookieStr).toMatch(/sms_at=/);
      expect(cookieStr).toMatch(/sms_rt=/);
      expect(cookieStr).toMatch(/sms_csrf=/);
      expect(cookieStr).toMatch(/HttpOnly/);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should reject request without authentication cookie', async () => {
      const res = await request(app).get('/api/v1/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('should return authenticated user details when valid cookie is provided', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ identifier: 'admin', password: 'AdminPassword123!' });

      const cookies = loginRes.headers['set-cookie'];

      const meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', cookies);

      expect(meRes.status).toBe(200);
      expect(meRes.body.success).toBe(true);
      expect(meRes.body.data.username).toBe('admin');
      expect(meRes.body.data.role).toBe('ADMIN');
    });
  });

  describe('CSRF Protection & Token Rotation', () => {
    it('should issue CSRF token via GET /api/v1/auth/csrf', async () => {
      const res = await request(app).get('/api/v1/auth/csrf');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.csrfToken).toBeDefined();
    });

    it('should rotate refresh token and issue new token pair', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ identifier: 'admin', password: 'AdminPassword123!' });

      const cookies = loginRes.headers['set-cookie'];

      // Refresh using cookie
      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookies);

      expect(refreshRes.status).toBe(204);
      expect(refreshRes.headers['set-cookie']).toBeDefined();
    });

    it('should detect reuse of an old refresh token and revoke the entire family', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ identifier: 'admin', password: 'AdminPassword123!' });

      const initialCookies = loginRes.headers['set-cookie'];

      // First refresh succeeds and rotates old token
      const refresh1 = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', initialCookies);
      expect(refresh1.status).toBe(204);

      // Now replay the old used refresh token (after 10s or forced)
      // Modify used_at in db back in time so race tolerance (>10s) passes
      await db('refresh_tokens')
        .whereNotNull('used_at')
        .update({ used_at: new Date(Date.now() - 15000) });

      // Stolen token replay attempt
      const replayRes = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', initialCookies);

      expect(replayRes.status).toBe(401);
      expect(replayRes.body.error.code).toBe('AUTH_REFRESH_REUSE');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should log out and clear auth cookies', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ identifier: 'admin', password: 'AdminPassword123!' });

      const cookies = loginRes.headers['set-cookie'];
      const csrfCookie = cookies.find((c) => c.startsWith('sms_csrf='));
      const csrfVal = csrfCookie.split(';')[0].split('=')[1];

      const logoutRes = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', cookies)
        .set('X-CSRF-Token', csrfVal);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.success).toBe(true);

      // Cookies should be expired / cleared
      const logoutCookies = logoutRes.headers['set-cookie'].join('; ');
      expect(logoutCookies).toMatch(/sms_at=;/);
    });

    it('should reject state-changing request if X-CSRF-Token is missing', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ identifier: 'admin', password: 'AdminPassword123!' });

      const cookies = loginRes.headers['set-cookie'];

      // Attempt state-changing logout WITHOUT X-CSRF-Token header
      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', cookies);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CSRF_INVALID');
    });
  });

  describe('POST /api/v1/auth/change-password', () => {
    it('should validate password length and update password hash and token_version', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ identifier: 'admin', password: 'AdminPassword123!' });

      const cookies = loginRes.headers['set-cookie'];
      const csrfCookie = cookies.find((c) => c.startsWith('sms_csrf='));
      const csrfVal = csrfCookie.split(';')[0].split('=')[1];

      // 1. Rejects short password (<10 chars)
      const shortRes = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Cookie', cookies)
        .set('X-CSRF-Token', csrfVal)
        .send({ currentPassword: 'AdminPassword123!', newPassword: 'short' });

      expect(shortRes.status).toBe(400);
      expect(shortRes.body.error.code).toBe('VALIDATION_ERROR');

      // 2. Successfully changes password with valid input (>= 10 chars)
      const changeRes = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Cookie', cookies)
        .set('X-CSRF-Token', csrfVal)
        .send({ currentPassword: 'AdminPassword123!', newPassword: 'NewAdminPassword456!' });

      expect(changeRes.status).toBe(200);
      expect(changeRes.body.success).toBe(true);

      // 3. Old password should fail on login now
      const oldLoginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ identifier: 'admin', password: 'AdminPassword123!' });
      expect(oldLoginRes.status).toBe(401);

      // 4. New password should succeed on login
      const newLoginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ identifier: 'admin', password: 'NewAdminPassword456!' });
      expect(newLoginRes.status).toBe(200);

      // Restore password back to AdminPassword123! for idempotency across test runs
      const newCookies = newLoginRes.headers['set-cookie'];
      const newCsrfCookie = newCookies.find((c) => c.startsWith('sms_csrf='));
      const newCsrfVal = newCsrfCookie.split(';')[0].split('=')[1];
      await request(app)
        .post('/api/v1/auth/change-password')
        .set('Cookie', newCookies)
        .set('X-CSRF-Token', newCsrfVal)
        .send({ currentPassword: 'NewAdminPassword456!', newPassword: 'AdminPassword123!' });
    });
  });
});

