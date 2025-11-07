import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Cleanup after each test
afterEach(() => {
    cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
    }),
});

// Mock window.origin
Object.defineProperty(window, "origin", {
    writable: true,
    value: "http://localhost:3000",
});

// Mock document.referrer
Object.defineProperty(document, "referrer", {
    value: "https://example.com",
    writable: true,
    configurable: true,
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
