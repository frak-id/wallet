/**
 * DOM Mock Utilities
 *
 * Reusable utilities for mocking window and document properties in tests.
 * These utilities help avoid repetitive Object.defineProperty boilerplate
 * and provide consistent mock behavior across test suites.
 *
 * Usage:
 * ```typescript
 * // In listener app setup:
 * import { setupListenerDomMocks } from "@frak-labs/test-foundation";
 * setupListenerDomMocks();
 *
 * // In individual tests with custom values:
 * import { mockWindowOrigin, mockDocumentReferrer } from "@frak-labs/test-foundation";
 * mockWindowOrigin("https://custom-origin.com");
 * mockDocumentReferrer("https://custom-parent.com");
 * ```
 */

/**
 * Mock window.origin property
 *
 * Used by listener app for iframe postMessage security - validates messages
 * come from expected origins.
 *
 * @param origin - The origin to set (default: "http://localhost:3000")
 *
 * @example
 * ```typescript
 * mockWindowOrigin("https://wallet.frak.id");
 * console.log(window.origin); // "https://wallet.frak.id"
 * ```
 */
export function mockWindowOrigin(origin = "http://localhost:3000") {
    Object.defineProperty(window, "origin", {
        writable: true,
        value: origin,
    });
}

/**
 * Mock document.referrer property
 *
 * Used by listener app to identify parent window origin in iframe contexts.
 * The referrer indicates which page embedded the iframe.
 *
 * @param referrer - The referrer URL to set (default: "https://example.com")
 *
 * @example
 * ```typescript
 * mockDocumentReferrer("https://parent-site.com");
 * console.log(document.referrer); // "https://parent-site.com"
 * ```
 */
export function mockDocumentReferrer(referrer = "https://example.com") {
    Object.defineProperty(document, "referrer", {
        value: referrer,
        writable: true,
        configurable: true,
    });
}

/**
 * Mock document.cookie property
 *
 * Useful for testing cookie-related functionality like demo mode detection
 * or session management. By default, document.cookie is read-only in jsdom.
 *
 * @param initialValue - Initial cookie string (default: "")
 *
 * @example
 * ```typescript
 * mockDocumentCookie("demo=true; session=abc123");
 * console.log(document.cookie); // "demo=true; session=abc123"
 * ```
 */
export function mockDocumentCookie(initialValue = "") {
    Object.defineProperty(document, "cookie", {
        writable: true,
        value: initialValue,
    });
}

/**
 * Mock window.history property
 *
 * Used for testing browser history manipulation (replaceState, pushState).
 * By default, window.history methods are read-only in JSDOM environment.
 * This mock allows testing code that calls window.history.replaceState/pushState.
 *
 * Note: This function must be called with the vi object from vitest since
 * vitest cannot be dynamically imported in CommonJS contexts.
 *
 * @param vi - The vitest mock object (import { vi } from "vitest")
 *
 * @example
 * ```typescript
 * import { vi } from "vitest";
 * import { mockWindowHistory } from "@frak-labs/test-foundation";
 *
 * mockWindowHistory(vi);
 * const historySpy = vi.mocked(window.history.replaceState);
 *
 * // Call your function that uses window.history
 * someFunction();
 *
 * expect(historySpy).toHaveBeenCalledWith(null, "", "https://example.com");
 * ```
 */
export function mockWindowHistory(vi: any) {
    Object.defineProperty(window, "history", {
        writable: true,
        value: {
            replaceState: vi.fn(),
            pushState: vi.fn(),
            back: vi.fn(),
            forward: vi.fn(),
            go: vi.fn(),
            length: 0,
            scrollRestoration: "auto" as ScrollRestoration,
            state: null,
        },
    });
}

/**
 * Complete DOM setup for listener app
 *
 * Combines window.origin and document.referrer mocks with sensible defaults
 * for iframe communication testing. This is the recommended way to set up
 * listener app tests.
 *
 * @param options - Optional configuration
 * @param options.origin - Custom window.origin (default: "http://localhost:3000")
 * @param options.referrer - Custom document.referrer (default: "https://example.com")
 *
 * @example
 * ```typescript
 * // In listener/tests/vitest-setup.ts:
 * import { setupListenerDomMocks } from "@frak-labs/test-foundation";
 * setupListenerDomMocks();
 *
 * // With custom values:
 * setupListenerDomMocks({
 *     origin: "https://wallet.frak.id",
 *     referrer: "https://content-creator.com"
 * });
 * ```
 */
export function setupListenerDomMocks(options?: {
    origin?: string;
    referrer?: string;
}) {
    const { origin, referrer } = options || {};
    mockWindowOrigin(origin);
    mockDocumentReferrer(referrer);
}
