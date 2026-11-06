import { createApp } from '../src/app.js';
import { db } from '../src/shared/db/knex.js';
import { sessionStore } from '../src/shared/session/sessionStore.js';
import http from 'http';

async function testLogoutAndRefreshLifecycle() {
  console.log('🚀 Testing Logout & Refresh Re-Authentication Prevention...\n');

  const app = createApp();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  let passed = 0;
  let failed = 0;

  function assert(condition, msg) {
    if (condition) {
      console.log(`  ✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${msg}`);
      failed++;
    }
  }

  try {
    const user = await db('users').where({ status: 'ACTIVE' }).first();
    if (!user) throw new Error('No user found');
    const initialTv = user.token_version;

    // 1. Create active server session
    const sess = await sessionStore.createSession({
      userId: user.id,
      roleCode: user.role_code || 'TEACHER',
      rememberMe: true
    });
    console.log(`Created session ${sess.sessionId.substring(0, 10)}... for user ${user.username}`);

    // 2. Call /api/v1/auth/me with session cookie -> 200 OK
    const authedRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Cookie: `sms_sid=${sess.sessionId}` }
    });
    assert(authedRes.status === 200, 'Authenticated request returns 200 OK before logout');

    // 3. Perform Logout
    console.log('\n--- Performing Logout ---');
    const logoutRes = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `sms_sid=${sess.sessionId}`
      }
    });
    assert(logoutRes.status === 200, 'Logout request returns 200 OK');

    const setCookieHeaders = logoutRes.headers.getSetCookie ? logoutRes.headers.getSetCookie() : [logoutRes.headers.get('set-cookie')];
    const hasClearedCookie = setCookieHeaders.some((h) => h && (h.includes('1970') || h.includes('Max-Age=0')));
    assert(hasClearedCookie, 'Logout response contains Set-Cookie clearing headers');

    // 4. Verify Session is Revoked in Store
    const sessionAfterLogout = await sessionStore.getSession(sess.sessionId);
    assert(sessionAfterLogout === null, 'Server session is revoked and returns null');

    // 5. Verify Token Version Incremented in MySQL
    const userAfterLogout = await db('users').where({ id: user.id }).first();
    assert(userAfterLogout.token_version > initialTv, `User token_version incremented (${initialTv} -> ${userAfterLogout.token_version})`);

    // 6. Simulate Browser Refresh with Stale/Surviving Cookie -> MUST BE REJECTED WITH 401
    console.log('\n--- Simulating Browser Refresh After Logout ---');
    const refreshMeRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Cookie: `sms_sid=${sess.sessionId}` }
    });
    assert(refreshMeRes.status === 401, 'Request to /auth/me after logout is strictly REJECTED with 401');

    console.log(`\n========================================`);
    console.log(`Results: ${passed} Passed, ${failed} Failed`);
    console.log(`========================================\n`);

  } catch (err) {
    console.error('Test error:', err);
    failed++;
  } finally {
    server.close();
    setTimeout(() => process.exit(failed > 0 ? 1 : 0), 100);
  }
}

testLogoutAndRefreshLifecycle();
