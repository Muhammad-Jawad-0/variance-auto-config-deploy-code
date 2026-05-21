import crypto from 'crypto';
import { SQLiteSessionStorage } from '@shopify/shopify-app-session-storage-sqlite';
import { Session } from '@shopify/shopify-api';

const ALGORITHM = 'aes-256-cbc';

// Simple token cache in memory to pass refresh tokens from fetch to sessionStorage
export const tokenCache = new Map();

// Intercept global fetch to append expiring=1 and cache the refresh token
const originalFetch = globalThis.fetch;
globalThis.fetch = async function (url, options) {
  const urlStr = typeof url === 'string' ? url : (url && url.toString ? url.toString() : '');
  if (urlStr.includes('/admin/oauth/access_token') && options && options.method === 'POST') {
    try {
      const body = JSON.parse(options.body);
      // Intercept OAuth code exchange
      if (body.code && (!body.grant_type || body.grant_type === 'authorization_code')) {
        body.expiring = 1;
        options.body = JSON.stringify(body);
        console.log(`[Shopify Auth Fetch Interceptor] Appended expiring=1 to code exchange request for: ${urlStr}`);
        
        const response = await originalFetch(url, options);
        if (response.ok) {
          try {
            const clonedResponse = response.clone();
            const responseData = await clonedResponse.json();
            if (responseData.refresh_token) {
              const shop = new URL(urlStr).hostname;
              tokenCache.set(shop, {
                refreshToken: responseData.refresh_token,
                refreshTokenExpires: responseData.refresh_token_expires_in
                  ? new Date(Date.now() + responseData.refresh_token_expires_in * 1000)
                  : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // fallback 90 days
              });
              console.log(`[Shopify Auth Fetch Interceptor] Cached refresh token for shop: ${shop}`);
            }
          } catch (err) {
            console.error('[Shopify Auth Fetch Interceptor] Error parsing token exchange response:', err.message);
          }
        }
        return response;
      }
    } catch (e) {
      // Ignore json parse error, fall through to default fetch
    }
  }
  return originalFetch(url, options);
};

// Error class for authentication specific failures
class ShopifyAuthError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

// Derive a 32-byte key from Shopify API Secret
function getEncryptionKey() {
  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret) {
    console.warn('[Shopify Auth] SHOPIFY_API_SECRET is not defined. Using fallback key for encryption (not recommended for production).');
    return crypto.createHash('sha256').update('fallback_secret_key').digest();
  }
  return crypto.createHash('sha256').update(secret).digest();
}

// Encrypt string value
export function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

// Decrypt string value
export function decrypt(encryptedText) {
  if (!encryptedText) return null;
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 2) return null;
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('[Shopify Auth] Failed to decrypt refresh token. Secret key might have changed.', error.message);
    return null;
  }
}

// API helper: Exchange permanent token for expiring token
async function exchangePermanentToExpiringToken(shop, permanentToken) {
  const clientId = process.env.SHOPIFY_API_KEY;
  const clientSecret = process.env.SHOPIFY_API_SECRET;
  
  console.log(`[Shopify Auth] Initiating token exchange migration for shop: ${shop}`);
  
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
      subject_token: permanentToken,
      subject_token_type: 'urn:shopify:params:oauth:token-type:offline-access-token',
      requested_token_type: 'urn:shopify:params:oauth:token-type:offline-access-token',
      expiring: 1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let parsedBody = {};
    try { parsedBody = JSON.parse(errorText); } catch (_) {}
    throw new ShopifyAuthError(
      `Token exchange failed: ${response.status} - ${errorText}`,
      response.status,
      parsedBody
    );
  }

  const data = await response.json();
  console.log(`[Shopify Auth] Token exchange migration successful for shop: ${shop}`);
  return data;
}

// API helper: Refresh OAuth token using refresh token
async function refreshOAuthToken(shop, refreshToken) {
  const clientId = process.env.SHOPIFY_API_KEY;
  const clientSecret = process.env.SHOPIFY_API_SECRET;
  
  console.log(`[Shopify Auth] Refreshing OAuth access token for shop: ${shop}`);
  
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let parsedBody = {};
    try { parsedBody = JSON.parse(errorText); } catch (_) {}
    throw new ShopifyAuthError(
      `Token refresh failed: ${response.status} - ${errorText}`,
      response.status,
      parsedBody
    );
  }

  const data = await response.json();
  console.log(`[Shopify Auth] Token refresh successful for shop: ${shop}`);
  return data;
}

// API helper: Request new token using Client Credentials Grant
async function requestClientCredentialsToken(shop) {
  const clientId = process.env.SHOPIFY_API_KEY;
  const clientSecret = process.env.SHOPIFY_API_SECRET;
  
  console.log(`[Shopify Auth] Requesting Client Credentials access token for shop: ${shop}`);
  
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let parsedBody = {};
    try { parsedBody = JSON.parse(errorText); } catch (_) {}
    throw new ShopifyAuthError(
      `Client credentials request failed: ${response.status} - ${errorText}`,
      response.status,
      parsedBody
    );
  }

  const data = await response.json();
  console.log(`[Shopify Auth] Client credentials token request successful for shop: ${shop}`);
  return data;
}

export class CustomSQLiteSessionStorage extends SQLiteSessionStorage {
  constructor(database, opts = {}) {
    super(database, opts);
    // Chain our custom DB migration logic after superclass setup completes
    this.ready = this.ready.then(async () => {
      await this.runCustomMigrations();
    });
  }

  async runCustomMigrations() {
    try {
      await this.db.query(`ALTER TABLE ${this.options.sessionTableName} ADD COLUMN refreshToken varchar(255)`);
      console.log('[Shopify Session Storage] Successfully added column: refreshToken');
    } catch (err) {
      if (!err.message.includes('duplicate column name') && !err.message.includes('already exists')) {
        console.warn('[Shopify Session Storage] Migration error (refreshToken):', err.message);
      }
    }

    try {
      await this.db.query(`ALTER TABLE ${this.options.sessionTableName} ADD COLUMN refreshTokenExpires integer`);
      console.log('[Shopify Session Storage] Successfully added column: refreshTokenExpires');
    } catch (err) {
      if (!err.message.includes('duplicate column name') && !err.message.includes('already exists')) {
        console.warn('[Shopify Session Storage] Migration error (refreshTokenExpires):', err.message);
      }
    }
  }

  async storeSession(session) {
    // Check if we have a cached refresh token from the fetch interceptor for this shop
    const cached = tokenCache.get(session.shop);
    if (cached) {
      session.refreshToken = cached.refreshToken;
      session.refreshTokenExpires = cached.refreshTokenExpires;
      tokenCache.delete(session.shop);
      console.log(`[Shopify Session Storage] Applied cached refresh token for shop: ${session.shop}`);
    }

    // 1. Let the base class store the standard session details
    await super.storeSession(session);

    // 2. Encrypt and save custom fields (refreshToken, refreshTokenExpires) if they exist
    if (session.refreshToken !== undefined || session.refreshTokenExpires !== undefined) {
      const encryptedRefreshToken = session.refreshToken ? encrypt(session.refreshToken) : null;
      const refreshTokenExpiresTime = session.refreshTokenExpires instanceof Date 
        ? Math.floor(session.refreshTokenExpires.getTime() / 1000) 
        : (typeof session.refreshTokenExpires === 'number' ? Math.floor(session.refreshTokenExpires / 1000) : null);

      const query = `
        UPDATE ${this.options.sessionTableName}
        SET refreshToken = ?, refreshTokenExpires = ?
        WHERE id = ?
      `;
      await this.db.query(query, [encryptedRefreshToken, refreshTokenExpiresTime, session.id]);
    }
    return true;
  }

  async loadSession(id) {
    await this.ready;
    const session = await super.loadSession(id);
    if (!session) return undefined;

    // Load custom columns
    const query = `
      SELECT refreshToken, refreshTokenExpires FROM ${this.options.sessionTableName}
      WHERE id = ?
    `;
    const rows = await this.db.query(query, [id]);
    if (rows && rows.length > 0) {
      const row = rows[0];
      if (row.refreshToken) {
        session.refreshToken = decrypt(row.refreshToken);
      }
      if (row.refreshTokenExpires) {
        session.refreshTokenExpires = new Date(row.refreshTokenExpires * 1000);
      }
    }

    return await this.checkAndRefreshSession(session);
  }

  async findSessionsByShop(shop) {
    await this.ready;
    const sessions = await super.findSessionsByShop(shop);
    if (!sessions || sessions.length === 0) return [];

    const updatedSessions = [];
    for (const session of sessions) {
      const query = `
        SELECT refreshToken, refreshTokenExpires FROM ${this.options.sessionTableName}
        WHERE id = ?
      `;
      const rows = await this.db.query(query, [session.id]);
      if (rows && rows.length > 0) {
        const row = rows[0];
        if (row.refreshToken) {
          session.refreshToken = decrypt(row.refreshToken);
        }
        if (row.refreshTokenExpires) {
          session.refreshTokenExpires = new Date(row.refreshTokenExpires * 1000);
        }
      }

      const updatedSession = await this.checkAndRefreshSession(session);
      if (updatedSession) {
        updatedSessions.push(updatedSession);
      }
    }
    return updatedSessions;
  }

  async checkAndRefreshSession(session) {
    if (!session) return undefined;

    // Only operate on offline sessions where long-lived access tokens are stored
    if (session.isOnline) {
      return session;
    }

    const isClientCredentials = process.env.SHOPIFY_AUTH_FLOW === 'client_credentials';

    // 1. Client Credentials flow
    if (isClientCredentials) {
      const isExpired = !session.expires || (session.expires.getTime() - 300000 < Date.now()); // 5 minutes buffer
      if (isExpired) {
        try {
          const data = await requestClientCredentialsToken(session.shop);
          session.accessToken = data.access_token;
          session.expires = new Date(Date.now() + data.expires_in * 1000);
          
          await this.storeSession(session);
          console.log(`[Shopify Auth] Refreshed Client Credentials token for shop: ${session.shop}`);
        } catch (error) {
          console.error(`[Shopify Auth] Client credentials refresh failed for ${session.shop}:`, error.message);
          if (error.status === 400 || error.status === 401) {
            await this.deleteSession(session.id);
            return undefined; // Forces re-auth
          }
        }
      }
      return session;
    }

    // 2. OAuth flow
    const hasRefreshToken = Boolean(session.refreshToken);
    const hasExpires = Boolean(session.expires);

    // Case A: Session has a permanent token (no expires, no refresh token). Migrate it to expiring token.
    if (!hasExpires && !hasRefreshToken && session.accessToken) {
      try {
        const data = await exchangePermanentToExpiringToken(session.shop, session.accessToken);
        session.accessToken = data.access_token;
        session.expires = new Date(Date.now() + data.expires_in * 1000);
        session.refreshToken = data.refresh_token;
        session.refreshTokenExpires = new Date(Date.now() + data.refresh_token_expires_in * 1000);
        
        await this.storeSession(session);
        console.log(`[Shopify Auth] Successfully migrated permanent token to expiring for shop: ${session.shop}`);
      } catch (error) {
        console.error(`[Shopify Auth] Permanent token migration failed for ${session.shop}:`, error.message);
        if (error.status === 400 || error.status === 401) {
          await this.deleteSession(session.id);
          return undefined; // Forces re-auth
        }
      }
      return session;
    }

    // Case B: Expiring token is close to expiry. Refresh it.
    if (hasExpires && hasRefreshToken) {
      // Check if refresh token itself is expired (90 days validity)
      if (session.refreshTokenExpires && session.refreshTokenExpires.getTime() < Date.now()) {
        console.warn(`[Shopify Auth] Refresh token expired for shop: ${session.shop}. Deleting session.`);
        await this.deleteSession(session.id);
        return undefined; // Forces re-auth
      }

      // Check if access token expires within 5 minutes (300 seconds)
      const isExpired = session.expires.getTime() - 300000 < Date.now();
      if (isExpired) {
        try {
          const data = await refreshOAuthToken(session.shop, session.refreshToken);
          session.accessToken = data.access_token;
          session.expires = new Date(Date.now() + data.expires_in * 1000);
          session.refreshToken = data.refresh_token;
          session.refreshTokenExpires = new Date(Date.now() + data.refresh_token_expires_in * 1000);

          await this.storeSession(session);
          console.log(`[Shopify Auth] Successfully auto-refreshed expiring token for shop: ${session.shop}`);
        } catch (error) {
          console.error(`[Shopify Auth] Token auto-refresh failed for ${session.shop}:`, error.message);
          if (error.status === 400 || error.status === 401) {
            await this.deleteSession(session.id);
            return undefined; // Forces re-auth
          }
        }
      }
    }

    return session;
  }
}
