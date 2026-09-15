/**
 * Core SDK test fixtures, following the same convention as apps/wallet and
 * packages/wallet-shared.
 */

import { test as baseTest } from "vitest";

export type SdkCoreTestFixtures = {
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

export const test = baseTest.extend<SdkCoreTestFixtures>({
    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
    mockUint8Arrays: async ({}, use) => {
        await use({
            empty: new Uint8Array([]),
            simple: new Uint8Array([72, 101, 108, 108, 111]), // "Hello"
            complex: new Uint8Array([0, 1, 2, 3, 255, 254, 253, 252, 127, 128]),
        });
    },

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
 * The hooks come straight from `vitest` rather than being destructured off the
 * extended `test`: no suite takes fixture arguments in a hook, and the
 * destructured form exports types naming vitest-internal declarations that
 * cannot be referenced from outside the package (TS4023).
 */
export {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
