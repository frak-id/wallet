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
 */

import { afterEach, beforeEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/preact";

// RTL's `waitFor` keeps its own 1s budget, independent of `testTimeout`. Ten
// projects sharing `cpus-1` workers put a cold transform inside that window,
// so a test awaiting a resolved promise fails on scheduling, not behaviour.
configure({ asyncUtilTimeout: 5000 });

// Mock window.FrakSetup global
declare global {
    interface Window {
        FrakSetup: {
            client?: unknown;
            config?: unknown;
            modalWalletConfig?: unknown;
            core?: unknown;
        };
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
        core: {},
    };
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

        // SSO actions
        openSso: vi.fn(),
        prepareSso: vi.fn(),

        // Merchant actions
        getMerchantInformation: vi.fn().mockResolvedValue({
            rewards: [],
        }),

        // Purchase tracking
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
        displayModal: vi.fn(),
        getMerchantInformation: vi.fn().mockResolvedValue({
            rewards: [],
        }),
        modalBuilder: vi.fn(),
        openSso: vi.fn(),
        prepareSso: vi.fn(),
        trackPurchaseStatus: vi.fn(),
        watchWalletStatus: vi.fn(),
    };
});
