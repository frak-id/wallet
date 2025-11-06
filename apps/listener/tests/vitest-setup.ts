/**
 * Vitest Setup File for Listener App Unit Tests
 *
 * This file imports shared React setup and provides listener-specific mocks:
 * - react-testing-library-setup.ts: RTL cleanup and jest-dom matchers
 * - react-setup.ts: BigInt serialization for Zustand
 * - shared-setup.ts: Browser API mocks (crypto, MessageChannel, IntersectionObserver)
 * - apps-setup.ts: Environment variables
 *
 * Listener-specific mocks:
 * - window.origin for iframe postMessage security
 * - document.referrer to identify parent window origin
 */

// Import shared React Testing Library setup (cleanup + jest-dom)
import "../../../test-setup/react-testing-library-setup";

// Import shared React setup (BigInt serialization)
import "../../../test-setup/react-setup";

// Mock window.origin (used for iframe postMessage security)
Object.defineProperty(window, "origin", {
    writable: true,
    value: "http://localhost:3000",
});

// Mock document.referrer (used to identify parent window origin)
Object.defineProperty(document, "referrer", {
    value: "https://example.com",
    writable: true,
    configurable: true,
});
