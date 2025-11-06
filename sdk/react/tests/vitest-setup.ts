/**
 * Vitest Setup File for React SDK Unit Tests
 *
 * Test Organization:
 * - Tests are co-located with source files (e.g., src/hooks/useFrakClient.test.ts)
 * - Use .test.ts or .test.tsx extension for test files
 * - Run tests with: bun run test (or bun run test:ui for Vitest UI)
 *
 * This file provides:
 * - Global test cleanup (React Testing Library)
 * - Browser API mocks (window, IntersectionObserver, MessageChannel, crypto)
 * - Core SDK action mocks (displayModal, openSso, watchWalletStatus, etc.)
 * - Frame connector error mocks (FrakRpcError, ClientNotFound)
 */

import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { JSDOM } from "jsdom";
import { afterEach, beforeAll, vi } from "vitest";

// Setup jsdom before tests
beforeAll(() => {
    const jsdom = new JSDOM("<!doctype html><html><body></body></html>", {
        url: "http://localhost",
        pretendToBeVisual: true,
    });
    global.window = jsdom.window as unknown as Window & typeof globalThis;
    global.document = jsdom.window.document;
    global.navigator = jsdom.window.navigator;

    // Setup BigInt serialization for potential Zustand persist middleware usage
    // biome-ignore lint/suspicious/noExplicitAny: BigInt.prototype doesn't have toJSON in type definition
    if (typeof BigInt !== "undefined" && !(BigInt.prototype as any).toJSON) {
        // biome-ignore lint/suspicious/noExplicitAny: BigInt.prototype doesn't have toJSON in type definition
        (BigInt.prototype as any).toJSON = function () {
            return this.toString();
        };
    }
});

// Cleanup after each test
afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

// Mock crypto.randomUUID if not available
if (!global.crypto) {
    global.crypto = {
        randomUUID: () => "test-uuid",
    } as unknown as Crypto;
}

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
    disconnect() {}
    observe() {}
    takeRecords() {
        return [];
    }
    unobserve() {}
} as unknown as typeof IntersectionObserver;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
    disconnect() {}
    observe() {}
    unobserve() {}
} as unknown as typeof ResizeObserver;

// Mock MessageChannel for iframe communication
global.MessageChannel = class MessageChannel {
    port1 = {
        postMessage: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        start: () => {},
        close: () => {},
    } as unknown as MessagePort;
    port2 = {
        postMessage: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        start: () => {},
        close: () => {},
    } as unknown as MessagePort;
} as unknown as typeof MessageChannel;

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
