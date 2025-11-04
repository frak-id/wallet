/**
 * Vitest Setup File for Dashboard V2 App Unit Tests
 *
 * Test Organization:
 * - Tests are co-located with source files (e.g., src/stores/campaignStore.test.ts)
 * - Use .test.ts or .test.tsx extension for test files
 * - Run tests with: bun run test (or bun run test:ui for Vitest UI)
 *
 * This file provides:
 * - Global test cleanup (React Testing Library)
 * - Environment variable mocking
 * - Common dependency mocks (TanStack Router, TanStack Query, etc.)
 */

import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Cleanup after each test
afterEach(() => {
    cleanup();
});

// Mock environment variables
vi.stubEnv("STAGE", "test");
vi.stubEnv("BACKEND_URL", "https://backend-test.frak.id");
vi.stubEnv("INDEXER_URL", "https://indexer-test.frak.id");
vi.stubEnv("FRAK_WALLET_URL", "https://wallet-test.frak.id");
vi.stubEnv("OPEN_PANEL_API_URL", "https://openpanel-test.frak.id");
vi.stubEnv("OPEN_PANEL_BUSINESS_CLIENT_ID", "test-client-id");

// Mock TanStack Router hooks
vi.mock("@tanstack/react-router", async () => {
    const actual = await vi.importActual<
        typeof import("@tanstack/react-router")
    >("@tanstack/react-router");
    return {
        ...actual,
        useNavigate: vi.fn(() => vi.fn()),
        useRouter: vi.fn(() => ({
            navigate: vi.fn(),
            buildLocation: vi.fn(),
            history: {
                go: vi.fn(),
                back: vi.fn(),
                forward: vi.fn(),
            },
        })),
        useMatchRoute: vi.fn(() => vi.fn()),
        useParams: vi.fn(() => ({})),
        useSearch: vi.fn(() => ({})),
        useLocation: vi.fn(() => ({
            href: "http://localhost:3022",
            pathname: "/",
            search: "",
            hash: "",
        })),
    };
});

// Mock TanStack Start specific hooks if needed
vi.mock("@tanstack/react-start", async () => {
    const actual = await vi.importActual<
        typeof import("@tanstack/react-start")
    >("@tanstack/react-start");
    return {
        ...actual,
    };
});

// Don't mock TanStack Query globally - tests will create their own QueryClient
// and mock only the API calls they need. This allows proper query state management.

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

// Mock document.cookie for demo mode store tests
Object.defineProperty(document, "cookie", {
    writable: true,
    value: "",
});
