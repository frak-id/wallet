/**
 * Vitest Setup File for Core SDK Unit Tests
 *
 * Test Organization:
 * - Tests are co-located with source files (e.g., src/utils/computeProductId.test.ts)
 * - Use .test.ts or .test.spec.ts extension for test files
 * - Run tests with: bun run test (or bun run test:ui for Vitest UI)
 *
 * This file provides:
 * - Global test cleanup
 * - Browser API mocks (window, IntersectionObserver, MessageChannel)
 * - No React-specific mocks (core SDK is framework-agnostic)
 */

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

    // JSDOM already sets window.location based on the URL option above
    // window.location.host will be "localhost" from the URL we provided
});

// Cleanup after each test
afterEach(() => {
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
