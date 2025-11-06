/**
 * Vitest Setup File for Core SDK Unit Tests
 *
 * Test Organization:
 * - Tests are co-located with source files (e.g., src/utils/computeProductId.test.ts)
 * - Use .test.ts or .test.spec.ts extension for test files
 * - Run tests with: bun run test (or bun run test:ui for Vitest UI)
 *
 * This file imports shared setup:
 * - shared-setup.ts: Browser API mocks (crypto, MessageChannel, IntersectionObserver, etc.)
 *
 * Note: Core SDK is framework-agnostic, so no React-specific setup is imported.
 */

import { afterEach, vi } from "vitest";

// Cleanup after each test (clear all mocks, not React cleanup)
afterEach(() => {
    vi.clearAllMocks();
});
