/**
 * Backend Vitest Setup
 *
 * This setup file configures all mocks for the Elysia backend tests.
 * It runs once per worker before any tests execute.
 *
 * Setup order (critical for proper initialization):
 * 1. Environment variables (JWT secrets, etc.) - must be set before any imports
 * 2. Bun runtime mocks (CryptoHasher for Node.js compatibility)
 * 3. Domain context mocks (prevents circular dependency issues)
 * 4. External library mocks (viem, permissionless, ox, web-push)
 * 5. Infrastructure mocks (DB, repositories, services)
 *
 * Mocked modules:
 * - bun - Bun runtime APIs (CryptoHasher)
 * - Domain contexts - Prevents circular dependencies during test imports
 * - viem/actions - Blockchain interaction mocks (readContract, simulateContract, etc.)
 * - permissionless/actions - Account abstraction mocks (getSenderAddress)
 * - ox - WebAuthn P256 signature verification
 * - @backend-infrastructure - Backend services (DB, repositories, JWT, logging)
 * - web-push - Push notification service
 *
 * Mock access:
 * - Import from test/mock/viem for viemActionsMocks, permissionlessActionsMocks, oxMocks
 * - Import from test/mock/common for dbMock and other infrastructure mocks
 */

/**
 * IMPORTANT: Set environment variables FIRST, before any imports
 * This ensures JWT context initialization has the required secrets
 */
process.env.JWT_SECRET = "test-jwt-secret-for-vitest-testing";
process.env.JWT_SDK_SECRET = "test-jwt-sdk-secret-for-vitest-testing";
process.env.PRODUCT_SETUP_CODE_SALT = "test-salt";
process.env.MASTER_KEY_SECRET = JSON.stringify({ masterPrivateKey: "123456" });

import { afterEach, vi } from "vitest";

// Mock Bun runtime APIs before anything else
class MockCryptoHasher {
    constructor(
        public algorithm: string,
        public secret: string
    ) {}

    update(_data: string) {
        return this;
    }

    digest() {
        return Buffer.from("mocked-hash");
    }
}

vi.mock("bun", () => ({
    CryptoHasher: MockCryptoHasher,
}));

// Mock domain contexts to prevent circular dependencies during test imports
// These contexts instantiate services at module load time, which can cause
// "is not a constructor" errors when the service files are being tested
vi.mock("../src/domain/auth/context", () => ({
    AuthContext: {
        repositories: {},
        services: {},
    },
}));

vi.mock("../src/domain/interactions/context", () => ({
    InteractionsContext: {
        repositories: {},
        services: {},
    },
}));

vi.mock("../src/domain/business/context", () => ({
    BusinessContext: {
        repositories: {},
        services: {},
    },
}));

vi.mock("../src/domain/oracle/context", () => ({
    OracleContext: {
        repositories: {},
        services: {},
    },
}));

vi.mock("../src/domain/notifications/context", () => ({
    NotificationsContext: {
        repositories: {},
        services: {},
    },
}));

vi.mock("../src/domain/pairing/context", () => ({
    PairingContext: {
        repositories: {},
        services: {},
    },
}));

// Import mock modules to initialize them
// These use vi.mock() at module level, so importing them sets up the mocks
import "./mock/viem";
import "./mock/common";

/**
 * Clean up after each test to prevent state leakage.
 * This clears all mock call history but keeps the mock implementations in place.
 */
afterEach(() => {
    vi.clearAllMocks();
});
