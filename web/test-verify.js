import { CustomSQLiteSessionStorage, encrypt, decrypt, tokenCache } from './utils/session-storage.js';
import { Session } from '@shopify/shopify-api';
import sqlite3 from 'sqlite3';
import assert from 'assert';

// Setup environment variables for test
process.env.SHOPIFY_API_KEY = 'test_api_key';
process.env.SHOPIFY_API_SECRET = 'test_api_secret';

const TEST_DB_PATH = './test-database.sqlite';

async function runTests() {
  console.log('🧪 Starting Authentication Migration Verification Tests...\n');

  // Test 1: Encryption and Decryption
  console.log('Test 1: Verifying Encryption / Decryption...');
  const originalToken = 'shprt_mock_refresh_token_xyz_12345';
  const encrypted = encrypt(originalToken);
  assert.notStrictEqual(encrypted, originalToken, 'Encrypted token should not match plain text');
  assert.ok(encrypted.includes(':'), 'Encrypted token format should contain iv separator ":"');
  const decrypted = decrypt(encrypted);
  assert.strictEqual(decrypted, originalToken, 'Decrypted token must match original token');
  console.log('✅ Encryption/Decryption verified successfully.\n');

  // Test 2: Custom SQLite Database Migration
  console.log('Test 2: Verifying database migrations...');
  const storage = new CustomSQLiteSessionStorage(TEST_DB_PATH);
  await storage.ready;
  
  // Connect directly to check schema
  const db = new sqlite3.Database(TEST_DB_PATH);
  
  const checkColumns = () => new Promise((resolve, reject) => {
    db.all('PRAGMA table_info(shopify_sessions)', (err, rows) => {
      if (err) reject(err);
      const columnNames = rows.map(r => r.name);
      assert.ok(columnNames.includes('refreshToken'), 'Database should contain "refreshToken" column');
      assert.ok(columnNames.includes('refreshTokenExpires'), 'Database should contain "refreshTokenExpires" column');
      resolve();
    });
  });

  await checkColumns();
  db.close();
  console.log('✅ Database columns verified successfully.\n');

  // Test 3: Session storing and loading with Custom Fields
  console.log('Test 3: Storing and loading session with custom properties...');
  const session = new Session({
    id: 'test-session-123',
    shop: 'test-store.myshopify.com',
    state: 'state-123',
    isOnline: false,
    scope: 'read_products',
    accessToken: 'shpat_permanent_token_mock',
  });
  
  // Set custom properties manually for the test
  session.refreshToken = 'shprt_refresh_token_abc';
  session.refreshTokenExpires = new Date(Date.now() + 86400 * 1000); // 1 day

  // Store session
  await storage.storeSession(session);

  // Load session and assert custom values are decrypted
  const loadedSession = await storage.loadSession(session.id);
  assert.ok(loadedSession, 'Loaded session should exist');
  assert.strictEqual(loadedSession.accessToken, 'shpat_permanent_token_mock', 'Access token should match');
  assert.strictEqual(loadedSession.refreshToken, 'shprt_refresh_token_abc', 'Decrypted refresh token should match');
  assert.ok(loadedSession.refreshTokenExpires instanceof Date, 'refreshTokenExpires should be a Date object');
  console.log('✅ Session store and load with encryption verified successfully.\n');

  // Test 4: Fetch Interceptor & Cached Tokens
  console.log('Test 4: Verifying fetch interceptor caching mechanism...');
  const mockShop = 'test-cache-store.myshopify.com';
  const mockRefreshToken = 'shprt_cached_token_999';
  const mockExpiresIn = 7776000;

  // Emulate global fetch interception result
  tokenCache.set(mockShop, {
    refreshToken: mockRefreshToken,
    refreshTokenExpires: new Date(Date.now() + mockExpiresIn * 1000)
  });

  const cacheSession = new Session({
    id: 'cache-session-id',
    shop: mockShop,
    state: 'state-abc',
    isOnline: false,
    scope: 'read_products',
    accessToken: 'shpat_initial_token',
  });

  // Store should apply cached token
  await storage.storeSession(cacheSession);

  // Load and verify caching worked
  const loadedCacheSession = await storage.loadSession(cacheSession.id);
  assert.strictEqual(loadedCacheSession.refreshToken, mockRefreshToken, 'Cached refresh token should be applied');
  assert.ok(loadedCacheSession.refreshTokenExpires, 'Cached refresh token expiration should be set');
  assert.strictEqual(tokenCache.has(mockShop), false, 'Token cache for shop should be cleared after store');
  console.log('✅ Fetch interceptor caching verified successfully.\n');

  // Test 5: Auto-refresh simulation (mocking fetch requests)
  console.log('Test 5: Simulating auto-refresh mechanism on load...');
  
  // Set access token to expire in the past
  loadedCacheSession.expires = new Date(Date.now() - 600000); // Expired 10 minutes ago
  await storage.storeSession(loadedCacheSession);
  
  // Mock global fetch to intercept the refresh token request
  const originalFetch = globalThis.fetch;
  let refreshCalled = false;
  
  globalThis.fetch = async (url, options) => {
    if (url.includes('/admin/oauth/access_token') && options.method === 'POST') {
      const body = JSON.parse(options.body);
      if (body.grant_type === 'refresh_token') {
        refreshCalled = true;
        return {
          ok: true,
          json: async () => ({
            access_token: 'shpat_NEW_refreshed_access_token_111',
            expires_in: 3600,
            refresh_token: 'shprt_NEW_refresh_token_222',
            refresh_token_expires_in: 7776000,
            scope: 'read_products'
          })
        };
      }
    }
    return originalFetch(url, options);
  };

  const refreshedSession = await storage.loadSession(loadedCacheSession.id);
  
  // Restore original fetch
  globalThis.fetch = originalFetch;

  assert.ok(refreshCalled, 'Global fetch refresh endpoint should have been called');
  assert.strictEqual(refreshedSession.accessToken, 'shpat_NEW_refreshed_access_token_111', 'Refreshed session access token should update');
  assert.strictEqual(refreshedSession.refreshToken, 'shprt_NEW_refresh_token_222', 'Refreshed session refresh token should update');
  assert.ok(refreshedSession.expires.getTime() > Date.now(), 'Session expiration should be in the future');
  
  console.log('✅ Auto-refresh simulation verified successfully.\n');

  console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! Authentication migration is fully functional.');
}

runTests().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
