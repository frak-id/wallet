/**
 * Vitest Setup File for React SDK Unit Tests
 *
 * Test Organization:
 * - Tests are co-located with source files (e.g., src/hooks/useFrakClient.test.ts)
 * - Use .test.ts or .test.tsx extension for test files
 * - Run tests with: bun run test (or bun run test:ui for Vitest UI)
 *
 * This file imports shared React setup and provides React SDK-specific mocks:
 * - react-testing-library-setup.ts: RTL cleanup and jest-dom matchers
 * - react-setup.ts: BigInt serialization for Zustand
 * - shared-setup.ts: Browser API mocks (crypto, MessageChannel, IntersectionObserver)
 *
 * React SDK-specific mocks:
 * - Core SDK action mocks (displayModal, openSso, watchWalletStatus, etc.)
 * - Frame connector error mocks (FrakRpcError, ClientNotFound)
 */

import { afterEach, vi } from "vitest";

// Import shared React Testing Library setup (cleanup + jest-dom)
import "../../../test-setup/react-testing-library-setup";

// Import shared React setup (BigInt serialization)
import "../../../test-setup/react-setup";

// Additional cleanup for SDK-specific mocks
afterEach(() => {
    vi.clearAllMocks(); // Clear SDK action mocks
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
        getProductInformation: vi.fn(),

        // Interaction actions
        sendInteraction: vi.fn(),
        trackPurchaseStatus: vi.fn(),

        // Wallet status
        watchWalletStatus: vi.fn(),

        // Transaction actions
        sendTransaction: vi.fn(),
        siweAuthenticate: vi.fn(),

        // Referral actions
        processReferral: vi.fn(),
        referralInteraction: vi.fn(),

        // Client creation (keep original implementation)
        createIFrameFrakClient: actual.createIFrameFrakClient,
        setupClient: actual.setupClient,
    };
});

// Mock @frak-labs/frame-connector errors
vi.mock("@frak-labs/frame-connector", async () => {
    const actual = await vi.importActual<
        typeof import("@frak-labs/frame-connector")
    >("@frak-labs/frame-connector");

    // Create mock error classes that extend Error
    class MockFrakRpcError extends Error {
        constructor(message: string) {
            super(message);
            this.name = "FrakRpcError";
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
    };
});

// Don't mock TanStack Query globally - tests will create their own QueryClient
// instances via fixtures. This allows proper query state management and testing.
