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
     * Mock merchant ID for testing
     */
    mockMerchantId: string;

    /**
     * Mock origin URL for testing
     */
    mockOrigin: string;
};

/**
 * Extended test with listener-specific fixtures
 */
export const test = baseTest.extend<
    Pick<ListenerTestFixtures, "mockMerchantId" | "mockOrigin">
>({
    /**
     * Mock merchant ID for testing RPC messages
     */
    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
    mockMerchantId: async ({}, use: (value: string) => Promise<void>) => {
        const merchantId = "test-merchant-id-1234";
        await use(merchantId);
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
 */
export const { beforeEach, afterEach, beforeAll, afterAll } = test;

/**
 * Re-export expect and other vitest utilities
 */
export { describe, expect, it, vi } from "vitest";
