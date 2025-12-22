/**
 * Tests for prefixWalletCss utility function
 * Tests CSS class name prefixing for wallet components
 */

import { describe, expect, it } from "vitest";
import { prefixWalletCss } from "./prefixWalletCss";

describe("prefixWalletCss", () => {
    describe("basic prefixing", () => {
        it("should prefix a simple class name", () => {
            const result = prefixWalletCss("content");

            expect(result).toBe("frak-wallet-content");
        });

        it("should prefix a class name with multiple words", () => {
            const result = prefixWalletCss("header-title");

            expect(result).toBe("frak-wallet-header-title");
        });

        it("should prefix an empty string", () => {
            const result = prefixWalletCss("");

            expect(result).toBe("frak-wallet-");
        });

        it("should prefix a single character", () => {
            const result = prefixWalletCss("a");

            expect(result).toBe("frak-wallet-a");
        });
    });

    describe("edge cases", () => {
        it("should handle class names with underscores", () => {
            const result = prefixWalletCss("header_title");

            expect(result).toBe("frak-wallet-header_title");
        });

        it("should handle class names with numbers", () => {
            const result = prefixWalletCss("item1");

            expect(result).toBe("frak-wallet-item1");
        });

        it("should handle class names with special characters", () => {
            const result = prefixWalletCss("item-2");

            expect(result).toBe("frak-wallet-item-2");
        });

        it("should handle very long class names", () => {
            const longName = "a".repeat(100);
            const result = prefixWalletCss(longName);

            expect(result).toBe(`frak-wallet-${longName}`);
        });
    });

    describe("consistency", () => {
        it("should always return the same prefix format", () => {
            const result1 = prefixWalletCss("test");
            const result2 = prefixWalletCss("test");

            expect(result1).toBe(result2);
            expect(result1).toBe("frak-wallet-test");
        });

        it("should maintain consistent prefix across different inputs", () => {
            const result1 = prefixWalletCss("header");
            const result2 = prefixWalletCss("footer");

            expect(result1.startsWith("frak-wallet-")).toBe(true);
            expect(result2.startsWith("frak-wallet-")).toBe(true);
            expect(result1).not.toBe(result2);
        });
    });
});
