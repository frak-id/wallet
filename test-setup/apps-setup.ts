/**
 * Shared Test Setup for Frontend Apps (Wallet, Listener, Business)
 *
 * This setup file provides environment variable mocking and common mocks
 * that are specific to frontend applications. It extends the shared-setup.ts
 * with app-specific configuration.
 *
 * Environment Variables:
 * - Core variables used by all apps (STAGE, BACKEND_URL, etc.)
 * - Analytics variables for OpenPanel tracking
 *
 * Mocks:
 * - OpenPanel analytics
 * - document.cookie (for demo mode and other cookie-based features)
 */

import { vi } from "vitest";

// Mock environment variables used across apps
vi.stubEnv("STAGE", "test");
vi.stubEnv("BACKEND_URL", "https://backend-test.frak.id");
vi.stubEnv("INDEXER_URL", "https://indexer-test.frak.id");
vi.stubEnv("FRAK_WALLET_URL", "https://wallet-test.frak.id");
vi.stubEnv("OPEN_PANEL_API_URL", "https://openpanel-test.frak.id");
vi.stubEnv("OPEN_PANEL_BUSINESS_CLIENT_ID", "test-client-id");

// Mock OpenPanel analytics (used across all frontend apps)
vi.mock("@openpanel/web", () => ({
    OpenPanel: vi.fn(() => ({
        identify: vi.fn(),
        track: vi.fn(),
        setProfile: vi.fn(),
    })),
}));

// Mock document.cookie (used by demo mode and other cookie-based features)
Object.defineProperty(document, "cookie", {
    writable: true,
    value: "",
});
