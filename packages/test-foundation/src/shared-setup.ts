/**
 * Shared Vitest Setup for All Projects
 *
 * This setup file provides common browser API mocks used across all test projects:
 * - crypto.randomUUID polyfill
 * - Browser API mocks (IntersectionObserver, ResizeObserver, matchMedia)
 * - MessageChannel (for iframe communication)
 * - localStorage/sessionStorage (jsdom's implementation is file-based and incomplete)
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

// jsdom's localStorage/sessionStorage require file paths and are incomplete
// Provide a proper in-memory Storage implementation instead
class StorageImpl implements Storage {
    private data = new Map<string, string>();

    get length(): number {
        return this.data.size;
    }

    clear(): void {
        this.data.clear();
    }

    getItem(key: string): string | null {
        return this.data.get(key) ?? null;
    }

    key(index: number): string | null {
        return Array.from(this.data.keys())[index] ?? null;
    }

    removeItem(key: string): void {
        this.data.delete(key);
    }

    setItem(key: string, value: string): void {
        this.data.set(key, String(value));
    }
}

// Set up storage IMMEDIATELY (before any module imports that use Zustand persist)
if (typeof window !== "undefined") {
    Object.defineProperty(window, "localStorage", {
        value: new StorageImpl(),
        writable: true,
        configurable: true,
    });

    Object.defineProperty(window, "sessionStorage", {
        value: new StorageImpl(),
        writable: true,
        configurable: true,
    });
}

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
