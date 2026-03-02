import "@shopify/shopify-app-react-router/server/adapters/node";
import {
    ApiVersion,
    AppDistribution,
    shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { MemorySessionStorage } from "@shopify/shopify-app-session-storage-memory";
import { DrizzleSessionStorageAdapter } from "../db/adapter/sessionAdapter";
import { sessionTable } from "../db/schema/sessionTable";
import { drizzleDb } from "./db.server";

// If the app is running locally, use the memory session storage
// Otherwise, use the drizzle session storage
const sessionStorageAdapter = process.env.SHOPIFY_APP_URL?.includes("localhost")
    ? new MemorySessionStorage()
    : new DrizzleSessionStorageAdapter(drizzleDb, sessionTable);

// Create the Shopify app
const shopify = shopifyApp({
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
    apiVersion: ApiVersion.January25,
    scopes: process.env.SCOPES?.split(","),
    appUrl: process.env.SHOPIFY_APP_URL || "",
    authPathPrefix: "/auth",
    sessionStorage: sessionStorageAdapter,
    distribution: AppDistribution.AppStore,
    ...(process.env.SHOP_CUSTOM_DOMAIN
        ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
        : {}),
});

export default shopify;
export const apiVersion = ApiVersion.October24;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
