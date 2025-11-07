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
 * import { setupListenerDomMocks } from "../../../test-setup/dom-mocks";
 * setupListenerDomMocks();
 *
 * // In individual tests with custom values:
 * import { mockWindowOrigin, mockDocumentReferrer } from "../../../test-setup/dom-mocks";
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
 * import { setupListenerDomMocks } from "../../../test-setup/dom-mocks";
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
