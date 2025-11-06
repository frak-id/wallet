/**
 * Shared React Testing Setup
 *
 * This setup file provides common setup logic for React-based projects:
 * - BigInt serialization for Zustand persist middleware
 *
 * Projects using this setup:
 * - apps/wallet
 * - apps/listener
 * - apps/business
 * - packages/wallet-shared
 * - sdk/react
 *
 * Note: Individual projects must still import @testing-library/jest-dom and
 * setup cleanup in their own setup files, as these dependencies aren't at root level.
 */

import { beforeAll } from "vitest";

// Setup BigInt serialization for Zustand persist middleware
// This is needed by any project using Zustand with persist (wallet, wallet-shared, react-sdk)
beforeAll(() => {
    // biome-ignore lint/suspicious/noExplicitAny: BigInt.prototype doesn't have toJSON in type definition
    if (typeof BigInt !== "undefined" && !(BigInt.prototype as any).toJSON) {
        // biome-ignore lint/suspicious/noExplicitAny: BigInt.prototype doesn't have toJSON in type definition
        (BigInt.prototype as any).toJSON = function () {
            return this.toString();
        };
    }
});
