/**
 * Core SDK test fixtures using Vitest's test.extend
 * Provides reusable, typed test setup for core SDK tests
 *
 * This file contains common fixtures used across core SDK tests.
 * Following the same convention as apps/wallet and packages/wallet-shared.
 */

import type { Address, Hex } from "viem";
import { test as baseTest } from "vitest";

/**
 * Core SDK test fixtures
 */
export type SdkCoreTestFixtures = {
    /**
     * Mock wallet addresses for testing
     */
    mockAddress: Address;
    mockAddress2: Address;

    /**
     * Mock hex values for article IDs, product IDs, etc.
     */
    mockArticleId: Hex;
    mockProductId: Hex;

    /**
     * Mock domain names for product ID computation
     */
    mockDomain: string;
    mockDomainWithWww: string;

    /**
     * Mock currency values for amount formatting
     */
    mockCurrencies: {
        eur: "eur";
        usd: "usd";
    };

    /**
     * Mock amount values for testing formatters
     */
    mockAmounts: {
        integer: number;
        decimal: number;
        large: number;
        zero: number;
    };

    /**
     * Mock interaction data structures
     */
    mockInteractionData: {
        articleId: Hex;
        productId: Hex;
    };

    /**
     * Mock purchase ID for purchase interactions
     */
    mockPurchaseId: Hex;

    /**
     * Mock merkle proof for purchase interactions
     */
    mockProof: Hex[];

    /**
     * Mock agency ID for retail interactions
     */
    mockAgencyId: Hex;

    /**
     * Mock referrer address for referral interactions
     */
    mockReferrerAddress: Address;

    /**
     * Mock Uint8Array for compression tests
     */
    mockUint8Arrays: {
        empty: Uint8Array;
        simple: Uint8Array;
        complex: Uint8Array;
    };

    /**
     * Mock base64url strings for compression tests
     */
    mockBase64Strings: {
        empty: string;
        simple: string;
        withSpecialChars: string;
    };
};

/**
 * Extended test with core SDK fixtures
 *
 * @example
 * ```ts
 * import { test, expect } from '@/tests/vitest-fixtures';
 *
 * test('should compute product ID', ({ mockDomain, mockProductId }) => {
 *     const result = computeProductId({ domain: mockDomain });
 *     expect(result).toBeDefined();
 * });
 * ```
 */
export const test = baseTest.extend<SdkCoreTestFixtures>({
    /**
     * Provides a consistent mock address for all tests
     */
    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
    mockAddress: async ({}, use) => {
        const address = "0x1234567890123456789012345678901234567890" as Address;
        await use(address);
    },

    /**
     * Provides a second mock address for testing
     */
    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
    mockAddress2: async ({}, use) => {
        const address = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Address;
        await use(address);
    },

    /**
     * Provides a mock article ID (32 bytes hex)
     */
    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
    mockArticleId: async ({}, use) => {
        const articleId =
            "0x0000000000000000000000000000000000000000000000000000000000000001" as Hex;
        await use(articleId);
    },

    /**
     * Provides a mock product ID (32 bytes hex)
     */
    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
    mockProductId: async ({}, use) => {
        const productId =
            "0x0000000000000000000000000000000000000000000000000000000000000002" as Hex;
        await use(productId);
    },

    /**
     * Provides mock domain names
     */
    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
    mockDomain: async ({}, use) => {
        await use("example.com");
    },

    /**
     * Provides mock domain with www prefix
     */
    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
    mockDomainWithWww: async ({}, use) => {
        await use("www.example.com");
    },

    /**
     * Provides mock currency values
     */
    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
    mockCurrencies: async ({}, use) => {
        await use({
            eur: "eur",
            usd: "usd",
        });
    },

    /**
     * Provides mock amount values
     */
    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
    mockAmounts: async ({}, use) => {
        await use({
            integer: 1000,
            decimal: 1234.56,
            large: 1000000,
            zero: 0,
        });
    },

    /**
     * Provides mock interaction data
     */
    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
    mockInteractionData: async ({}, use) => {
        await use({
            articleId:
                "0x0000000000000000000000000000000000000000000000000000000000000001" as Hex,
            productId:
                "0x0000000000000000000000000000000000000000000000000000000000000002" as Hex,
        });
    },

    /**
     * Provides mock purchase ID
     */
    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
    mockPurchaseId: async ({}, use) => {
        const purchaseId =
            "0x0000000000000000000000000000000000000000000000000000000000000abc" as Hex;
        await use(purchaseId);
    },

    /**
     * Provides mock merkle proof
     */
    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
    mockProof: async ({}, use) => {
        const proof = [
            "0x0000000000000000000000000000000000000000000000000000000000000001" as Hex,
            "0x0000000000000000000000000000000000000000000000000000000000000002" as Hex,
            "0x0000000000000000000000000000000000000000000000000000000000000003" as Hex,
        ];
        await use(proof);
    },

    /**
     * Provides mock agency ID
     */
    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
    mockAgencyId: async ({}, use) => {
        const agencyId =
            "0x0000000000000000000000000000000000000000000000000000000000000def" as Hex;
        await use(agencyId);
    },

    /**
     * Provides mock referrer address
     */
    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
    mockReferrerAddress: async ({}, use) => {
        const address = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Address;
        await use(address);
    },

    /**
     * Provides mock Uint8Array data
     */
    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
    mockUint8Arrays: async ({}, use) => {
        await use({
            empty: new Uint8Array([]),
            simple: new Uint8Array([72, 101, 108, 108, 111]), // "Hello"
            complex: new Uint8Array([0, 1, 2, 3, 255, 254, 253, 252, 127, 128]),
        });
    },

    /**
     * Provides mock base64url strings
     */
    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
    mockBase64Strings: async ({}, use) => {
        await use({
            empty: "",
            simple: "SGVsbG8", // "Hello" in base64url
            withSpecialChars: "AB-_", // Contains URL-safe characters
        });
    },
});

/**
 * Type-aware hooks that have access to fixtures
 *
 * @example
 * ```ts
 * import { test, beforeEach } from './tests/vitest-fixtures';
 *
 * beforeEach(({ mockDomain }) => {
 *     // Setup with typed fixtures
 *     console.log(`Testing with domain: ${mockDomain}`);
 * });
 *
 * test('should use fixtures', ({ mockArticleId }) => {
 *     // Test with typed fixtures
 *     expect(mockArticleId).toBeDefined();
 * });
 * ```
 */
export const { beforeEach, afterEach, beforeAll, afterAll } = test;

/**
 * Re-export expect and other vitest utilities
 */
export { describe, expect, it, vi } from "vitest";
