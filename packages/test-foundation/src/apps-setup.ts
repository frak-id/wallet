/**
 * Env stubs and a writable `document.cookie` for the frontend apps
 * (wallet, listener, business). Runs after `shared-setup.ts`.
 */

import { vi } from "vitest";

// Mock environment variables used across apps
vi.stubEnv("STAGE", "test");
vi.stubEnv("BACKEND_URL", "https://backend-test.frak.id");
vi.stubEnv("FRAK_WALLET_URL", "https://wallet-test.frak.id");
vi.stubEnv("OPEN_PANEL_API_URL", "https://openpanel-test.frak.id");
vi.stubEnv("OPEN_PANEL_BUSINESS_CLIENT_ID", "test-client-id");
vi.stubEnv("OPEN_PANEL_WALLET_CLIENT_ID", "test-wallet-client-id");

// Mock document.cookie (used by demo mode and other cookie-based features)
Object.defineProperty(document, "cookie", {
    writable: true,
    value: "",
});
