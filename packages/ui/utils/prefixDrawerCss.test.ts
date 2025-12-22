/**
 * Tests for prefixDrawerCss utility function
 * Tests CSS class name prefixing for drawer components
 */

import { describe, expect, it } from "vitest";
import { prefixDrawerCss } from "./prefixDrawerCss";

describe("prefixDrawerCss", () => {
    describe("basic prefixing", () => {
        it("should prefix a simple class name", () => {
            const result = prefixDrawerCss("content");

            expect(result).toBe("nexus-drawer-content");
        });

        it("should prefix a class name with multiple words", () => {
            const result = prefixDrawerCss("header-title");

            expect(result).toBe("nexus-drawer-header-title");
        });

        it("should prefix an empty string", () => {
            const result = prefixDrawerCss("");

            expect(result).toBe("nexus-drawer-");
        });

        it("should prefix a single character", () => {
            const result = prefixDrawerCss("a");

            expect(result).toBe("nexus-drawer-a");
        });
    });

    describe("edge cases", () => {
        it("should handle class names with underscores", () => {
            const result = prefixDrawerCss("header_title");

            expect(result).toBe("nexus-drawer-header_title");
        });

        it("should handle class names with numbers", () => {
            const result = prefixDrawerCss("item1");

            expect(result).toBe("nexus-drawer-item1");
        });

        it("should handle class names with special characters", () => {
            const result = prefixDrawerCss("item-2");

            expect(result).toBe("nexus-drawer-item-2");
        });

        it("should handle very long class names", () => {
            const longName = "a".repeat(100);
            const result = prefixDrawerCss(longName);

            expect(result).toBe(`nexus-drawer-${longName}`);
        });
    });

    describe("consistency", () => {
        it("should always return the same prefix format", () => {
            const result1 = prefixDrawerCss("test");
            const result2 = prefixDrawerCss("test");

            expect(result1).toBe(result2);
            expect(result1).toBe("nexus-drawer-test");
        });

        it("should maintain consistent prefix across different inputs", () => {
            const result1 = prefixDrawerCss("header");
            const result2 = prefixDrawerCss("footer");

            expect(result1.startsWith("nexus-drawer-")).toBe(true);
            expect(result2.startsWith("nexus-drawer-")).toBe(true);
            expect(result1).not.toBe(result2);
        });
    });
});
