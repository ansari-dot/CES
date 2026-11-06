import { createApp } from './src/app.js';
import { db } from './src/shared/db/knex.js';
import { sessionStore } from './src/shared/session/sessionStore.js';
import { getCacheRedis } from './src/shared/redis/redisClient.js';
import http from 'http';
import { initSocketServer } from './src/shared/realtime/socket.js';
import { io as ClientIO } from 'socket.io-client';

async function runTests() {
  console.log('🚀 Starting Comprehensive Authentication & Session Security Verification...\n');
  const app = createApp();
  const server = http.createServer(app);
  initSocketServer(server);

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`📡 Test server running on ${baseUrl}\n`);

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // Find an active user in DB
    const testUser = await db('users').where({ status: 'ACTIVE' }).first();
    if (!testUser) {
      throw new Error('No active user found in database to test.');
    }
    console.log(`👤 Using test user: ${testUser.username} (Role ID: ${testUser.role_id})`);

    // 1. Invalid Credentials Test
    console.log('\n--- 1. Testing Invalid Credentials ---');
    const invalidRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: testUser.username, password: 'WrongPassword123!' })
    });
    assert(invalidRes.status === 401, 'Invalid credentials returns 401 Unauthorized');

    // 2. Direct Session Creation & Validation (Testing SessionStore)
    console.log('\n--- 2. Testing SessionStore (Redis L1 + MySQL L2) ---');
    const sessRemember = await sessionStore.createSession({
      userId: testUser.id,
      roleCode: 'TEACHER',
      userAgent: 'Mozilla/5.0 TestSuite',
      ipAddress: '127.0.0.1',
      rememberMe: true
    });
    assert(sessRemember.sessionId && sessRemember.sessionId.length === 64, 'Session ID is 256-bit cryptographically secure hex');
    assert(sessRemember.isRemember === true, 'Session respects rememberMe=true');

    // Retrieve session from Redis cache
    const cachedSess = await sessionStore.getSession(sessRemember.sessionId);
    assert(cachedSess && cachedSess.userId === testUser.id, 'Session retrieved correctly from Redis L1 cache');

    // 3. Test Session Persistence Across Redis Flushes / Server Restarts (L2 MySQL Fallback)
    console.log('\n--- 3. Testing Backend Restart & Session Persistence (L2 Store) ---');
    const redis = getCacheRedis();
    if (redis) {
      // Simulate Redis cache eviction / Redis restart by deleting the key from Redis
      await redis.del(`sess:${sessRemember.sessionId}`);
    }
    // Session should still resolve from MySQL user_sessions and re-hydrate Redis!
    const rehydratedSess = await sessionStore.getSession(sessRemember.sessionId);
    assert(rehydratedSess && rehydratedSess.userId === testUser.id, 'Session survives Redis eviction via MySQL persistent store');

    // 4. Authenticated Request using Session Cookie
    console.log('\n--- 4. Testing Authenticated /api/v1/auth/me Request via Session Cookie ---');
    const meRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: {
        Cookie: `sms_sid=${sessRemember.sessionId}`
      }
    });
    assert(meRes.status === 200, 'Authenticated request with sms_sid cookie returns 200 OK');
    const meData = await meRes.json();
    assert(meData.data && meData.data.id === testUser.id, 'Response contains authenticated user data without exposing session ID');

    // 5. Concurrent Session Support
    console.log('\n--- 5. Testing Multiple Concurrent Sessions ---');
    const sess2 = await sessionStore.createSession({
      userId: testUser.id,
      roleCode: 'TEACHER',
      rememberMe: false
    });
    assert(sess2.sessionId !== sessRemember.sessionId, 'Second session gets unique independent session ID');
    const sess1Check = await sessionStore.getSession(sessRemember.sessionId);
    const sess2Check = await sessionStore.getSession(sess2.sessionId);
    assert(sess1Check && sess2Check, 'Both concurrent sessions are active simultaneously');

    // 6. Single Session Revocation (Logout)
    console.log('\n--- 6. Testing Single Session Invalidation (Logout) ---');
    await sessionStore.revokeSession(sess2.sessionId, 'LOGOUT');
    const sess2Revoked = await sessionStore.getSession(sess2.sessionId);
    const sess1StillActive = await sessionStore.getSession(sessRemember.sessionId);
    assert(sess2Revoked === null, 'Revoked session is rejected on subsequent requests');
    assert(sess1StillActive !== null, 'Other concurrent sessions remain active after single logout');

    // 7. Logout All Devices
    console.log('\n--- 7. Testing Logout From All Devices ---');
    await sessionStore.revokeAllUserSessions(testUser.id, 'LOGOUT_ALL');
    const sess1AfterLogoutAll = await sessionStore.getSession(sessRemember.sessionId);
    assert(sess1AfterLogoutAll === null, 'All sessions for user are invalidated on logoutAll');

    // 8. WebSocket Authentication via Session Cookie
    console.log('\n--- 8. Testing WebSocket Session Cookie Authentication ---');
    const wsSession = await sessionStore.createSession({
      userId: testUser.id,
      roleCode: 'TEACHER',
      rememberMe: true
    });

    const clientSocket = ClientIO(baseUrl, {
      extraHeaders: {
        Cookie: `sms_sid=${wsSession.sessionId}`
      },
      transports: ['websocket']
    });

    const wsAuthed = await new Promise((resolve) => {
      clientSocket.on('connect', () => {
        resolve(true);
      });
      clientSocket.on('connect_error', () => {
        resolve(false);
      });
      setTimeout(() => resolve(false), 3000);
    });
    assert(wsAuthed === true, 'WebSocket connects and authenticates using secure session cookie');
    clientSocket.disconnect();
    clientSocket.close();
    await sessionStore.revokeSession(wsSession.sessionId);

    // 9. Unauthenticated Request Rejection
    console.log('\n--- 9. Testing Unauthenticated Request Rejection ---');
    const unauthedRes = await fetch(`${baseUrl}/api/v1/auth/me`);
    assert(unauthedRes.status === 401, 'Unauthenticated request to protected endpoint rejected with 401');

    console.log(`\n========================================`);
    console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
    console.log(`========================================\n`);

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    server.close();
    setTimeout(() => process.exit(failed > 0 ? 1 : 0), 200);
  }
}

runTests();
