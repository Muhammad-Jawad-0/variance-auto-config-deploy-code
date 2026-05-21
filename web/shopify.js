import { BillingInterval, LATEST_API_VERSION } from "@shopify/shopify-api";
import { shopifyApp } from "@shopify/shopify-app-express";
import { CustomSQLiteSessionStorage } from "./utils/session-storage.js";
import { restResources } from "@shopify/shopify-api/rest/admin/2024-10";

const DB_PATH = `${process.cwd()}/database.sqlite`;

// The transactions with Shopify will always be marked as test transactions, unless NODE_ENV is production.
// See the ensureBilling helper to learn more about billing in this template.
const billingConfig = {
  "My Shopify One-Time Charge": {
    // This is an example configuration that would do a one-time charge for $5 (only USD is currently supported)
    amount: 5.0,
    currencyCode: "USD",
    interval: BillingInterval.OneTime,
  },
};

const shopify = shopifyApp({
  api: {
    apiVersion: LATEST_API_VERSION,
    restResources,
    future: {
      customerAddressDefaultFix: true,
      lineItemBilling: true,
      unstable_managedPricingSupport: true,
    },
    billing: undefined, // or replace with billingConfig above to enable example billing
  },
  auth: {
    path: "/api/auth",
    callbackPath: "/api/auth/callback",
  },
  webhooks: {
    path: "/api/webhooks",
  },
// Use our custom SQLite storage wrapper which handles expiring tokens and migrations
  sessionStorage: new CustomSQLiteSessionStorage(DB_PATH),
});

// Wrap Graphql client to intercept 401 Unauthorized errors, force refresh, and retry once
const originalGraphqlClient = shopify.api.clients.Graphql;
class WrappedGraphqlClient extends originalGraphqlClient {
  constructor(params) {
    super(params);
    this.session = params.session;
    this.apiVersion = params.apiVersion;
  }

  async query(params) {
    try {
      return await super.query(params);
    } catch (error) {
      if (this.isUnauthorized(error)) {
        console.warn(`[Shopify Client Retry] Detected 401 on query for shop: ${this.session.shop}. Attempting force refresh.`);
        // Reloading session through our custom storage triggers automatic background refresh if expired
        const freshSession = await shopify.config.sessionStorage.loadSession(this.session.id);
        if (freshSession) {
          // Re-instantiate internal client with new access token
          const tempClient = new originalGraphqlClient({
            session: freshSession,
            apiVersion: this.apiVersion
          });
          this.client = tempClient.client;
          this.session = freshSession;
          console.log('[Shopify Client Retry] Client re-created with fresh token. Retrying query...');
          return await super.query(params);
        }
      }
      throw error;
    }
  }

  async request(operation, options) {
    try {
      return await super.request(operation, options);
    } catch (error) {
      if (this.isUnauthorized(error)) {
        console.warn(`[Shopify Client Retry] Detected 401 on request for shop: ${this.session.shop}. Attempting force refresh.`);
        const freshSession = await shopify.config.sessionStorage.loadSession(this.session.id);
        if (freshSession) {
          const tempClient = new originalGraphqlClient({
            session: freshSession,
            apiVersion: this.apiVersion
          });
          this.client = tempClient.client;
          this.session = freshSession;
          console.log('[Shopify Client Retry] Client re-created with fresh token. Retrying request...');
          return await super.request(operation, options);
        }
      }
      throw error;
    }
  }

  isUnauthorized(error) {
    const statusCode = error.response?.code || error.response?.status || error.status || 0;
    return (
      statusCode === 401 ||
      error.message?.includes('401') ||
      (error.body && error.body.errors && error.body.errors.some(e => e.message?.includes('401') || e.message?.toLowerCase().includes('unauthorized')))
    );
  }
}

shopify.api.clients.Graphql = WrappedGraphqlClient;

export default shopify;
