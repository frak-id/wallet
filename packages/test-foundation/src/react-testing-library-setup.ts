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
import { act, cleanup, configure } from "@testing-library/react";
import { afterAll, afterEach } from "vitest";

// RTL's `waitFor` keeps its own 1s budget, independent of `testTimeout`. Ten
// projects sharing `cpus-1` workers put a cold transform inside that window,
// so a test awaiting a dynamic import fails on load rather than on behaviour.
configure({ asyncUtilTimeout: 5000 });

// Inside act: Preact 11 (listener aliases this import to preact) defers unmount cleanups past paint.
afterEach(() => {
    act(() => {
        cleanup();
    });
});

// Radix's focus scope dispatches its unmount event from a `setTimeout(0)`. One
// left pending when a file ends fires after Vitest tears down jsdom and throws
// on the realm mismatch, failing the run while every test passes.
afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
});
