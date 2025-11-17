/**
 * Shared Vitest Setup for All Projects
 *
 * This setup file provides common browser API mocks used across all test projects:
 * - crypto.randomUUID polyfill
 * - Browser API mocks (IntersectionObserver, ResizeObserver, matchMedia)
 * - MessageChannel (for iframe communication)
 *
 * Note: JSDOM environment (window, document, navigator) is automatically provided
 * by Vitest's `environment: "jsdom"` config setting in vitest.shared.ts.
 * This setup runs AFTER Vitest has initialized the JSDOM environment.
 *
 * Individual projects handle their own:
 * - React Testing Library setup (via react-setup.ts)
 * - BigInt serialization (via react-setup.ts for Zustand persist)
 * - Project-specific mocks (Wagmi, Router, SDK actions, etc.)
 */

import { beforeAll, vi } from "vitest";

// Setup browser API mocks after JSDOM environment is ready
beforeAll(() => {
    // Mock crypto.randomUUID if not available in test environment
    if (!global.crypto) {
        global.crypto = {
            randomUUID: () => "test-uuid",
        } as unknown as Crypto;
    }

    // Mock window.matchMedia (used by many UI components for responsive design)
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

    // Mock IntersectionObserver (used for lazy loading, infinite scroll, etc.)
    global.IntersectionObserver = class IntersectionObserver {
        disconnect() {}
        observe() {}
        takeRecords() {
            return [];
        }
        unobserve() {}
    } as unknown as typeof IntersectionObserver;

    // Mock ResizeObserver (used for responsive components, size detection)
    global.ResizeObserver = class ResizeObserver {
        disconnect() {}
        observe() {}
        unobserve() {}
    } as unknown as typeof ResizeObserver;

    // Mock MessageChannel (used for iframe communication in listener, core-sdk, react-sdk)
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
});
