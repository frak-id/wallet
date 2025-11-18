/**
 * Backend Vitest Setup
 *
 * Setup order:
 * 1. Environment variables - must be set before imports
 * 2. Bun runtime mocks (CryptoHasher)
 * 3. Domain context mocks (prevents circular dependencies)
 * 4. External library mocks (viem, permissionless, ox, Airtable)
 * 5. Infrastructure mocks (DB, repositories, services)
 */
process.env.JWT_SECRET = "test-jwt-secret-for-vitest-testing";
process.env.JWT_SDK_SECRET = "test-jwt-sdk-secret-for-vitest-testing";
process.env.PRODUCT_SETUP_CODE_SALT = "test-salt";
process.env.MASTER_KEY_SECRET = JSON.stringify({ masterPrivateKey: "123456" });

import { afterEach, vi } from "vitest";

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

vi.mock("bun", () => ({ CryptoHasher: MockCryptoHasher }));

// Mock domain contexts to prevent circular dependencies
const mockContext = { repositories: {}, services: {} };
vi.mock("../src/domain/auth/context", () => ({ AuthContext: mockContext }));
vi.mock("../src/domain/interactions/context", () => ({
    InteractionsContext: mockContext,
}));
vi.mock("../src/domain/business/context", () => ({
    BusinessContext: mockContext,
}));
vi.mock("../src/domain/oracle/context", () => ({ OracleContext: mockContext }));
vi.mock("../src/domain/notifications/context", () => ({
    NotificationsContext: mockContext,
}));
vi.mock("../src/domain/pairing/context", () => ({
    PairingContext: mockContext,
}));

// Mock Airtable integration
vi.mock("../src/infrastructure/integrations/airtable", async () => {
    const config = await import(
        "../src/infrastructure/integrations/airtable/config"
    );
    class MockAirtableRepository {
        processRequest = vi.fn();
        checkDuplicateEmail = vi.fn();
        createRecord = vi.fn();
        sendSlackNotification = vi.fn();
    }
    return { ...config, AirtableRepository: MockAirtableRepository };
});

import "./mock/viem";
import "./mock/common";

afterEach(() => {
    vi.clearAllMocks();
});
