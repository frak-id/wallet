/**
 * Tests for prefixModalCss utility function
 * Tests CSS class name prefixing for modal components
 */

import { describe, expect, it } from "vitest";
import { prefixModalCss } from "./prefixModalCss";

describe("prefixModalCss", () => {
    describe("basic prefixing", () => {
        it("should prefix a simple class name", () => {
            const result = prefixModalCss("content");

            expect(result).toBe("nexus-modal-content");
        });

        it("should prefix a class name with multiple words", () => {
            const result = prefixModalCss("header-title");

            expect(result).toBe("nexus-modal-header-title");
        });

        it("should prefix an empty string", () => {
            const result = prefixModalCss("");

            expect(result).toBe("nexus-modal-");
        });

        it("should prefix a single character", () => {
            const result = prefixModalCss("a");

            expect(result).toBe("nexus-modal-a");
        });
    });

    describe("edge cases", () => {
        it("should handle class names with underscores", () => {
            const result = prefixModalCss("header_title");

            expect(result).toBe("nexus-modal-header_title");
        });

        it("should handle class names with numbers", () => {
            const result = prefixModalCss("item1");

            expect(result).toBe("nexus-modal-item1");
        });

        it("should handle class names with special characters", () => {
            const result = prefixModalCss("item-2");

            expect(result).toBe("nexus-modal-item-2");
        });

        it("should handle very long class names", () => {
            const longName = "a".repeat(100);
            const result = prefixModalCss(longName);

            expect(result).toBe(`nexus-modal-${longName}`);
        });
    });

    describe("consistency", () => {
        it("should always return the same prefix format", () => {
            const result1 = prefixModalCss("test");
            const result2 = prefixModalCss("test");

            expect(result1).toBe(result2);
            expect(result1).toBe("nexus-modal-test");
        });

        it("should maintain consistent prefix across different inputs", () => {
            const result1 = prefixModalCss("header");
            const result2 = prefixModalCss("footer");

            expect(result1.startsWith("nexus-modal-")).toBe(true);
            expect(result2.startsWith("nexus-modal-")).toBe(true);
            expect(result1).not.toBe(result2);
        });
    });
});
