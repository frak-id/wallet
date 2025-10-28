/**
 * Vitest Setup File for Wallet App Unit Tests
 *
 * Test Organization:
 * - Tests are co-located with source files (e.g., app/module/stores/recoveryStore.test.ts)
 * - Use .test.ts or .test.tsx extension for test files
 * - Run tests with: bun run test (or bun run test:ui for Vitest UI)
 *
 * This file provides:
 * - Global test cleanup (React Testing Library)
 * - Environment variable mocking
 * - Common dependency mocks (Wagmi, TanStack Query, WebAuthn, etc.)
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
});

// Cleanup after each test
afterEach(() => {
    cleanup();
});

// Mock environment variables
vi.stubEnv("STAGE", "test");
vi.stubEnv("BACKEND_URL", "https://backend-test.frak.id");
vi.stubEnv("INDEXER_URL", "https://indexer-test.frak.id");
vi.stubEnv("FRAK_WALLET_URL", "https://wallet-test.frak.id");

// Mock Wagmi hooks
vi.mock("wagmi", () => ({
    useAccount: vi.fn(() => ({
        address: "0x1234567890123456789012345678901234567890",
        isConnected: true,
        isConnecting: false,
        isDisconnected: false,
        isReconnecting: false,
        status: "connected",
    })),
    useConnect: vi.fn(() => ({
        connect: vi.fn(),
        connectors: [],
        error: null,
        isLoading: false,
        pendingConnector: null,
    })),
    useDisconnect: vi.fn(() => ({
        disconnect: vi.fn(),
    })),
    useBalance: vi.fn(() => ({
        data: {
            formatted: "1.0",
            symbol: "ETH",
            value: 1000000000000000000n,
            decimals: 18,
        },
        isLoading: false,
        error: null,
    })),
    useConfig: vi.fn(() => ({
        chains: [],
        transports: {},
    })),
}));

// Don't mock TanStack Query globally - tests will create their own QueryClient
// and mock only the API calls they need. This allows proper query state management.

// Mock React Router
vi.mock("react-router", async () => {
    const actual =
        await vi.importActual<typeof import("react-router")>("react-router");
    return {
        ...actual,
        useNavigate: vi.fn(() => vi.fn()),
        useLocation: vi.fn(() => ({
            pathname: "/",
            search: "",
            hash: "",
            state: null,
        })),
        useParams: vi.fn(() => ({})),
        useSearchParams: vi.fn(() => [new URLSearchParams(), vi.fn()]),
    };
});

// Mock WebAuthn browser API
vi.mock("@simplewebauthn/browser", () => ({
    startRegistration: vi.fn(),
    startAuthentication: vi.fn(),
    browserSupportsWebAuthn: vi.fn(() => true),
    browserSupportsWebAuthnAutofill: vi.fn(() => false),
}));

// Mock IndexedDB (idb-keyval)
vi.mock("idb-keyval", () => ({
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    clear: vi.fn(),
    keys: vi.fn(() => []),
    values: vi.fn(() => []),
    entries: vi.fn(() => []),
}));

// Mock OpenPanel analytics
vi.mock("@openpanel/web", () => ({
    OpenPanel: vi.fn(() => ({
        identify: vi.fn(),
        track: vi.fn(),
        setProfile: vi.fn(),
    })),
}));

// Mock crypto.randomUUID if not available
if (!global.crypto) {
    global.crypto = {
        randomUUID: () => "test-uuid",
    } as unknown as Crypto;
}

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

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
