/**
 * Dashboard V2 app test fixtures extending base fixtures
 * Adds dashboard-specific fixtures to the shared base fixtures
 */

import {
    type BaseTestFixtures,
    test as baseTest,
} from "@frak-labs/wallet-shared/tests/vitest-fixtures";
import type { Address } from "viem";
import type { AuthSessionClient } from "@/types/AuthSession";

/**
 * Creates a mock Ethereum address for testing
 * Can be used in fixtures or directly in tests/mocks
 * @param seed - Optional seed for generating different addresses (will be hashed to hex)
 * @example
 * createMockAddress("product") // 0x1234567890123456789012345678901234567890
 * createMockAddress("member1") // 0xabcdef1234567890123456789012345678901234
 */
export function createMockAddress(seed = "default"): Address {
    // Create a simple hash from the seed to ensure valid hex chars
    const hash = seed
        .split("")
        .reduce((acc, char) => acc + char.charCodeAt(0), 0);

    // Generate a repeating pattern based on the hash
    const hexPattern = hash.toString(16).padStart(8, "0").slice(0, 8);
    const address = hexPattern.repeat(5).slice(0, 40);

    return `0x${address}` as Address;
}

/**
 * Dashboard-specific test fixtures (extends BaseTestFixtures)
 */
export type DashboardTestFixtures = BaseTestFixtures & {
    /**
     * Mock authentication session for business dashboard
     */
    mockAuthSession: AuthSessionClient;

    /**
     * Fresh campaign store that auto-resets before and after each test
     */
    freshCampaignStore: typeof import("@/stores/campaignStore").campaignStore;

    /**
     * Fresh currency store that auto-resets before and after each test
     */
    freshCurrencyStore: typeof import("@/stores/currencyStore").currencyStore;

    /**
     * Fresh auth store that auto-resets before and after each test
     */
    freshAuthStore: typeof import("@/stores/authStore").useAuthStore;

    /**
     * Fresh members store that auto-resets before and after each test
     */
    freshMembersStore: typeof import("@/stores/membersStore").membersStore;

    /**
     * Fresh push creation store that auto-resets before and after each test
     */
    freshPushCreationStore: typeof import("@/stores/pushCreationStore").pushCreationStore;
};

/**
 * Extended test with dashboard-specific fixtures
 * Use this instead of the base test for dashboard app tests
 *
 * @example
 * ```ts
 * import { test, expect } from '@/tests/fixtures';
 *
 * test('should use fresh campaign store', ({ freshCampaignStore, mockAddress }) => {
 *     // freshCampaignStore from dashboard-specific fixtures
 *     // mockAddress from base fixtures
 *     freshCampaignStore.getState().setStep(2);
 *     expect(freshCampaignStore.getState().step).toBe(2);
 * });
 * ```
 */
export const test = baseTest.extend<
    Pick<
        DashboardTestFixtures,
        | "mockAuthSession"
        | "freshCampaignStore"
        | "freshCurrencyStore"
        | "freshAuthStore"
        | "freshMembersStore"
        | "freshPushCreationStore"
    >
>({
    /**
     * Provides a mock authentication session for business dashboard tests
     * Uses createMockAddress from wallet-shared for proper type safety
     */
    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
    mockAuthSession: async ({}, use) => {
        const session: AuthSessionClient = {
            wallet: createMockAddress("business"),
        };
        await use(session);
    },

    /**
     * Provides a fresh campaign store that auto-resets
     * Store is reset before and after each test
     */
    freshCampaignStore: async (
        // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
        {},
        use: (
            value: typeof import("@/stores/campaignStore").campaignStore
        ) => Promise<void>
    ) => {
        const { campaignStore } = await import("@/stores/campaignStore");

        // Clear localStorage to reset persisted state
        localStorage.removeItem("campaign");

        // Reset before use
        campaignStore.getState().reset();

        await use(campaignStore);

        // Reset after use
        campaignStore.getState().reset();
        localStorage.removeItem("campaign");
    },

    /**
     * Provides a fresh currency store that auto-resets
     * Store is reset before and after each test
     */
    freshCurrencyStore: async (
        // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
        {},
        use: (
            value: typeof import("@/stores/currencyStore").currencyStore
        ) => Promise<void>
    ) => {
        const { currencyStore } = await import("@/stores/currencyStore");

        // Clear localStorage to reset persisted state
        localStorage.removeItem("business_preferredCurrency");

        // Reset to default before use
        currencyStore.getState().setCurrency("eur");

        await use(currencyStore);

        // Reset after use
        currencyStore.getState().setCurrency("eur");
        localStorage.removeItem("business_preferredCurrency");
    },

    /**
     * Provides a fresh auth store that auto-resets
     * Store is reset before and after each test
     */
    freshAuthStore: async (
        // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
        {},
        use: (
            value: typeof import("@/stores/authStore").useAuthStore
        ) => Promise<void>
    ) => {
        const { useAuthStore } = await import("@/stores/authStore");

        // Clear localStorage to reset persisted state
        localStorage.removeItem("business-auth");

        // Reset to default before use
        useAuthStore.getState().clearAuth();

        await use(useAuthStore);

        // Reset after use
        useAuthStore.getState().clearAuth();
        localStorage.removeItem("business-auth");
    },

    /**
     * Provides a fresh members store that auto-resets
     * Store is reset before and after each test
     */
    freshMembersStore: async (
        // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
        {},
        use: (
            value: typeof import("@/stores/membersStore").membersStore
        ) => Promise<void>
    ) => {
        const { membersStore } = await import("@/stores/membersStore");

        // Reset before use
        membersStore.getState().clearSelection();
        membersStore.getState().setTableFilters({ limit: 10, offset: 0 });
        membersStore.getState().setTableFiltersCount(0);

        await use(membersStore);

        // Reset after use
        membersStore.getState().clearSelection();
        membersStore.getState().setTableFilters({ limit: 10, offset: 0 });
        membersStore.getState().setTableFiltersCount(0);
    },

    /**
     * Provides a fresh push creation store that auto-resets
     * Store is reset before and after each test
     */
    freshPushCreationStore: async (
        // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
        {},
        use: (
            value: typeof import("@/stores/pushCreationStore").pushCreationStore
        ) => Promise<void>
    ) => {
        const { pushCreationStore } = await import(
            "@/stores/pushCreationStore"
        );

        // Clear localStorage to reset persisted state
        localStorage.removeItem("currentPushCampaignForm");

        // Reset before use
        pushCreationStore.getState().clearForm();

        await use(pushCreationStore);

        // Reset after use
        pushCreationStore.getState().clearForm();
        localStorage.removeItem("currentPushCampaignForm");
    },
});

/**
 * Type-aware hooks that have access to fixtures
 *
 * @example
 * ```ts
 * import { test, beforeEach } from '@/tests/fixtures';
 *
 * beforeEach(({ freshCampaignStore, mockSession }) => {
 *     // Setup with typed fixtures from both base and dashboard-specific
 *     freshCampaignStore.getState().setStep(1);
 * });
 * ```
 */
export const { beforeEach, afterEach, beforeAll, afterAll } = test;

/**
 * Re-export expect and other vitest utilities
 */
export { describe, expect, it, vi } from "vitest";

/**
 * Helper type for test callback parameters
 * Use this to explicitly type fixture parameters in tests when TypeScript can't infer them
 *
 * @example
 * ```ts
 * import { test, expect, type TestContext } from '@/tests/fixtures';
 *
 * test('should work', ({ freshCampaignStore }: TestContext) => {
 *     expect(freshCampaignStore).toBeDefined();
 * });
 * ```
 */
export type TestContext = DashboardTestFixtures;
