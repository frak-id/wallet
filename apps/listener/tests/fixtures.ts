/**
 * Listener app test fixtures extending base fixtures
 * Adds listener-specific fixtures to the shared base fixtures
 */

import {
    type BaseTestFixtures,
    test as baseTest,
} from "@frak-labs/wallet-shared/tests/vitest-fixtures";

/**
 * Listener-specific test fixtures (extends BaseTestFixtures)
 */
export type ListenerTestFixtures = BaseTestFixtures & {
    /**
     * Mock product ID for testing
     */
    mockProductId: `0x${string}`;

    /**
     * Mock origin URL for testing
     */
    mockOrigin: string;
};

/**
 * Extended test with listener-specific fixtures
 * Use this instead of the base test for listener app tests
 *
 * @example
 * ```ts
 * import { test, expect } from '@/tests/fixtures';
 *
 * test('should handle RPC message', ({ mockProductId, mockOrigin, mockAddress }) => {
 *     // mockProductId and mockOrigin from listener-specific fixtures
 *     // mockAddress from base fixtures
 *     expect(mockProductId).toMatch(/^0x/);
 *     expect(mockOrigin).toBeDefined();
 * });
 * ```
 */
export const test = baseTest.extend<
    Pick<ListenerTestFixtures, "mockProductId" | "mockOrigin">
>({
    /**
     * Mock product ID for testing RPC messages
     */
    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
    mockProductId: async ({}, use: (value: `0x${string}`) => Promise<void>) => {
        const productId =
            "0x1234567890abcdef1234567890abcdef12345678" as `0x${string}`;
        await use(productId);
    },

    /**
     * Mock origin URL for testing cross-origin communication
     */
    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
    mockOrigin: async ({}, use: (value: string) => Promise<void>) => {
        const origin = "https://example.frak.id";
        await use(origin);
    },
});

/**
 * Type-aware hooks that have access to fixtures
 *
 * @example
 * ```ts
 * import { test, beforeEach } from '@/tests/fixtures';
 *
 * beforeEach(({ mockSession, mockProductId }) => {
 *     // Setup with typed fixtures from both base and listener-specific
 *     sessionStore.getState().setSession(mockSession);
 *     resolvingContextStore.getState().updateContext({ productId: mockProductId });
 * });
 * ```
 */
export const { beforeEach, afterEach, beforeAll, afterAll } = test;

/**
 * Re-export expect and other vitest utilities
 */
export { describe, expect, it, vi } from "vitest";
