/**
 * React Testing Library Cleanup Setup
 *
 * Provides @testing-library/jest-dom matchers and automatic cleanup
 * after each test for all React-based projects.
 *
 * This shared setup file eliminates code duplication across multiple projects
 * by centralizing the React Testing Library cleanup logic.
 *
 * Projects using this setup:
 * - apps/wallet
 * - apps/listener
 * - apps/business
 * - packages/wallet-shared
 * - sdk/react
 *
 * Usage:
 * Import this file in your project's vitest-setup.ts:
 * ```typescript
 * import "@frak-labs/test-foundation/react-testing-library-setup";
 * ```
 */

import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Cleanup React Testing Library after each test
// This ensures DOM is clean between tests and prevents memory leaks
afterEach(() => {
    cleanup();
});
