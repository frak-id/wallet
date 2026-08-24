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
import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

// RTL's `waitFor` keeps its own 1s budget, independent of `testTimeout`. Ten
// projects sharing `cpus-1` workers put a cold transform inside that window,
// so a test awaiting a dynamic import fails on load rather than on behaviour.
configure({ asyncUtilTimeout: 5000 });

// Cleanup React Testing Library after each test
// This ensures DOM is clean between tests and prevents memory leaks
afterEach(() => {
    cleanup();
});
