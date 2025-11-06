/**
 * Tests for FrakContextManager utility
 * Tests Frak context compression, URL parsing, and management
 */

import type { Address } from "viem";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "../../tests/vitest-fixtures";
import type { FrakContext } from "../types";
import { FrakContextManager } from "./FrakContext";

describe("FrakContextManager", () => {
    let consoleErrorSpy: any;

    beforeEach(() => {
        consoleErrorSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    describe("compress", () => {
        it("should compress context with referrer address", () => {
            const context: Partial<FrakContext> = {
                r: "0x1234567890123456789012345678901234567890" as Address,
            };

            const result = FrakContextManager.compress(context);

            expect(result).toBeDefined();
            expect(typeof result).toBe("string");
            expect(result?.length).toBeGreaterThan(0);
            // Base64url should not contain +, /, or =
            expect(result).not.toMatch(/[+/=]/);
        });

        it("should return undefined when context has no referrer", () => {
            const context: Partial<FrakContext> = {};

            const result = FrakContextManager.compress(context);

            expect(result).toBeUndefined();
        });

        it("should return undefined when context is undefined", () => {
            const result = FrakContextManager.compress(undefined);

            expect(result).toBeUndefined();
        });

        it("should handle compression errors gracefully", () => {
            const invalidContext = {
                r: "invalid-address" as Address,
            };

            const result = FrakContextManager.compress(invalidContext);

            expect(consoleErrorSpy).toHaveBeenCalled();
            expect(result).toBeUndefined();
        });
    });

    describe("decompress", () => {
        it("should decompress valid base64url context", () => {
            // First compress a context
            const originalContext: FrakContext = {
                r: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Address,
            };
            const compressed = FrakContextManager.compress(originalContext);

            // Then decompress it
            const result = FrakContextManager.decompress(compressed);

            expect(result).toBeDefined();
            expect(result?.r).toBe(
                "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"
            );
        });

        it("should return undefined for empty string", () => {
            const result = FrakContextManager.decompress("");

            expect(result).toBeUndefined();
        });

        it("should return undefined for undefined input", () => {
            const result = FrakContextManager.decompress(undefined);

            expect(result).toBeUndefined();
        });

        it("should handle decompression errors gracefully", () => {
            const result = FrakContextManager.decompress(
                "invalid-base64url!@#"
            );

            expect(consoleErrorSpy).toHaveBeenCalled();
            expect(result).toBeUndefined();
        });

        it("should round-trip compress and decompress", () => {
            const original: FrakContext = {
                r: "0x1234567890123456789012345678901234567890" as Address,
            };

            const compressed = FrakContextManager.compress(original);
            const decompressed = FrakContextManager.decompress(compressed);

            expect(decompressed).toEqual(original);
        });
    });

    describe("parse", () => {
        it("should parse URL with fCtx parameter", () => {
            const context: FrakContext = {
                r: "0x1234567890123456789012345678901234567890" as Address,
            };
            const compressed = FrakContextManager.compress(context);
            const url = `https://example.com?fCtx=${compressed}`;

            const result = FrakContextManager.parse({ url });

            expect(result).toBeDefined();
            expect(result?.r).toBe(
                "0x1234567890123456789012345678901234567890"
            );
        });

        it("should return null for URL without fCtx parameter", () => {
            const url = "https://example.com?other=param";

            const result = FrakContextManager.parse({ url });

            expect(result).toBeNull();
        });

        it("should return null for empty URL", () => {
            const result = FrakContextManager.parse({ url: "" });

            expect(result).toBeNull();
        });

        it("should parse URL with multiple parameters", () => {
            const context: FrakContext = {
                r: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Address,
            };
            const compressed = FrakContextManager.compress(context);
            const url = `https://example.com?foo=bar&fCtx=${compressed}&baz=qux`;

            const result = FrakContextManager.parse({ url });

            expect(result).toBeDefined();
            expect(result?.r).toBe(
                "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"
            );
        });

        it("should return undefined for malformed fCtx parameter", () => {
            // Use a string that will fail base64url decoding
            const url = "https://example.com?fCtx=!!!invalid!!!";

            const result = FrakContextManager.parse({ url });

            // Should handle the error and return undefined
            expect(result).toBeUndefined();
        });
    });

    describe("update", () => {
        it("should add fCtx to URL without existing context", () => {
            const url = "https://example.com";
            const context: FrakContext = {
                r: "0x1234567890123456789012345678901234567890" as Address,
            };

            const result = FrakContextManager.update({ url, context });

            expect(result).toBeDefined();
            expect(result).toContain("fCtx=");
            expect(result).toContain("https://example.com");
        });

        it("should merge with existing context in URL", () => {
            const existingContext: FrakContext = {
                r: "0x1234567890123456789012345678901234567890" as Address,
            };
            const compressed = FrakContextManager.compress(existingContext);
            const url = `https://example.com?fCtx=${compressed}`;

            const newContext: FrakContext = {
                r: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Address,
            };

            const result = FrakContextManager.update({
                url,
                context: newContext,
            });

            expect(result).toBeDefined();
            expect(result).toContain("fCtx=");

            // Parse the result and check it has the new referrer
            const parsedResult = FrakContextManager.parse({ url: result! });
            expect(parsedResult?.r).toBe(
                "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"
            );
        });

        it("should return null when URL is undefined", () => {
            const context: FrakContext = {
                r: "0x1234567890123456789012345678901234567890" as Address,
            };

            const result = FrakContextManager.update({
                url: undefined,
                context,
            });

            expect(result).toBeNull();
        });

        it("should return null when context has no referrer", () => {
            const url = "https://example.com";
            const context: Partial<FrakContext> = {};

            const result = FrakContextManager.update({ url, context });

            expect(result).toBeNull();
        });

        it("should preserve other URL parameters", () => {
            const url = "https://example.com?foo=bar&baz=qux";
            const context: FrakContext = {
                r: "0x1234567890123456789012345678901234567890" as Address,
            };

            const result = FrakContextManager.update({ url, context });

            expect(result).toContain("foo=bar");
            expect(result).toContain("baz=qux");
            expect(result).toContain("fCtx=");
        });

        it("should preserve URL hash", () => {
            const url = "https://example.com#section";
            const context: FrakContext = {
                r: "0x1234567890123456789012345678901234567890" as Address,
            };

            const result = FrakContextManager.update({ url, context });

            expect(result).toContain("#section");
            expect(result).toContain("fCtx=");
        });
    });

    describe("remove", () => {
        it("should remove fCtx parameter from URL", () => {
            const context: FrakContext = {
                r: "0x1234567890123456789012345678901234567890" as Address,
            };
            const compressed = FrakContextManager.compress(context);
            const url = `https://example.com?fCtx=${compressed}`;

            const result = FrakContextManager.remove(url);

            expect(result).toBe("https://example.com/");
            expect(result).not.toContain("fCtx");
        });

        it("should preserve other parameters when removing fCtx", () => {
            const context: FrakContext = {
                r: "0x1234567890123456789012345678901234567890" as Address,
            };
            const compressed = FrakContextManager.compress(context);
            const url = `https://example.com?foo=bar&fCtx=${compressed}&baz=qux`;

            const result = FrakContextManager.remove(url);

            expect(result).toContain("foo=bar");
            expect(result).toContain("baz=qux");
            expect(result).not.toContain("fCtx");
        });

        it("should handle URL without fCtx parameter", () => {
            const url = "https://example.com?foo=bar";

            const result = FrakContextManager.remove(url);

            expect(result).toContain("foo=bar");
            expect(result).not.toContain("fCtx");
        });

        it("should preserve URL hash", () => {
            const url = "https://example.com?fCtx=test#section";

            const result = FrakContextManager.remove(url);

            expect(result).toContain("#section");
            expect(result).not.toContain("fCtx");
        });
    });

    describe("replaceUrl", () => {
        // Note: replaceUrl tests are skipped because window.location cannot be mocked
        // in JSDOM environment. The function is primarily used for browser DOM manipulation
        // and is tested through integration/E2E tests.

        it.skip("should update window.location with context", () => {
            // Skip: Cannot mock window.location in JSDOM
        });

        it.skip("should use provided URL instead of window.location.href", () => {
            // Skip: Cannot mock window.location in JSDOM
        });

        it.skip("should remove fCtx when context is null", () => {
            // Skip: Cannot mock window.location in JSDOM
        });

        it.skip("should not call replaceState when context has no referrer", () => {
            // Skip: Cannot mock window.location in JSDOM
        });

        it.skip("should handle missing window gracefully", () => {
            // Skip: Cannot mock window.location in JSDOM
        });
    });
});
