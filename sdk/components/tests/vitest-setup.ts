/**
 * Vitest Setup File for Components SDK Unit Tests
 *
 * Test Organization:
 * - Tests are co-located with source files (e.g., src/components/ButtonWallet/ButtonWallet.test.tsx)
 * - Use .test.ts or .test.tsx extension for test files
 * - Run tests with: bun run test (or bun run test:ui for Vitest UI)
 *
 * This file imports shared setup and provides Components SDK-specific mocks:
 * - shared-setup.ts: Browser API mocks (crypto, MessageChannel, IntersectionObserver, etc.)
 * - window.FrakSetup: Global SDK configuration and client mocks
 * - @frak-labs/core-sdk: Core SDK action mocks
 * - @frak-labs/frame-connector: Error class mocks
 */

import { afterEach, beforeEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/preact";

// Mock window.FrakSetup global
declare global {
    interface Window {
        FrakSetup: {
            client?: unknown;
            config?: unknown;
            modalWalletConfig?: unknown;
            modalShareConfig?: unknown;
            core?: unknown;
        };
        frakSetupInProgress?: boolean;
        modalBuilderSteps?: unknown;
    }
}

// Setup window.FrakSetup mock before each test
beforeEach(() => {
    // Reset window.FrakSetup
    window.FrakSetup = {
        client: {
            config: {
                metadata: {
                    currency: "eur",
                },
            },
            debugInfo: {
                formatDebugInfo: vi.fn((error: unknown) => {
                    return `Debug info: ${error}`;
                }),
            },
        },
        config: {
            metadata: {
                currency: "eur",
            },
        },
        modalWalletConfig: {
            metadata: {
                position: "right",
            },
        },
        modalShareConfig: {},
        core: {},
    };
    window.frakSetupInProgress = false;
    window.modalBuilderSteps = undefined;
});

// Cleanup Preact Testing Library after each test
afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

// Mock @frak-labs/core-sdk actions
// These are mocked globally so tests can customize behavior via vi.mocked()
vi.mock("@frak-labs/core-sdk", async () => {
    const actual = await vi.importActual<typeof import("@frak-labs/core-sdk")>(
        "@frak-labs/core-sdk"
    );
    return {
        ...actual,
        // Modal actions
        displayModal: vi.fn(),
        displayEmbeddedWallet: vi.fn(),

        // SSO actions
        openSso: vi.fn(),
        prepareSso: vi.fn(),

        // Product actions
        getProductInformation: vi.fn().mockResolvedValue({
            maxReferrer: {
                eurAmount: 10,
            },
            rewards: [],
        }),

        // Interaction actions
        sendInteraction: vi.fn(),
        trackPurchaseStatus: vi.fn(),

        // Wallet status
        watchWalletStatus: vi.fn(),

        // Utility functions
        formatAmount: vi.fn((amount: number, currency?: string) => {
            return `${amount} ${currency ?? "eur"}`;
        }),
        getCurrencyAmountKey: vi.fn((currency?: string) => {
            return `${currency ?? "eur"}Amount`;
        }),
        trackEvent: vi.fn(),

        // Client creation (keep original implementation)
        createIFrameFrakClient: actual.createIFrameFrakClient,
        setupClient: actual.setupClient,
    };
});

// Mock @frak-labs/core-sdk/actions
vi.mock("@frak-labs/core-sdk/actions", async () => {
    const actual = await vi.importActual<
        typeof import("@frak-labs/core-sdk/actions")
    >("@frak-labs/core-sdk/actions");
    return {
        ...actual,
        displayEmbeddedWallet: vi.fn(),
        displayModal: vi.fn(),
        getProductInformation: vi.fn().mockResolvedValue({
            maxReferrer: {
                eurAmount: 10,
            },
            rewards: [],
        }),
        openSso: vi.fn(),
        prepareSso: vi.fn(),
        sendInteraction: vi.fn(),
        trackPurchaseStatus: vi.fn(),
        watchWalletStatus: vi.fn(),
    };
});

// Mock @frak-labs/frame-connector errors
vi.mock("@frak-labs/frame-connector", async () => {
    const actual = await vi.importActual<
        typeof import("@frak-labs/frame-connector")
    >("@frak-labs/frame-connector");

    // Create mock error classes that extend Error
    class MockFrakRpcError extends Error {
        code: string;
        constructor(message: string, code?: string) {
            super(message);
            this.name = "FrakRpcError";
            this.code = code ?? "UNKNOWN_ERROR";
        }
    }

    class MockClientNotFound extends Error {
        constructor(message: string) {
            super(message);
            this.name = "ClientNotFound";
        }
    }

    return {
        ...actual,
        FrakRpcError: MockFrakRpcError,
        ClientNotFound: MockClientNotFound,
        RpcErrorCodes: {
            clientAborted: "CLIENT_ABORTED",
        },
    };
});
