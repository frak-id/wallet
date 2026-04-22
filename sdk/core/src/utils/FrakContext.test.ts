import { mockWindowHistory } from "@frak-labs/test-foundation";
import type { Address } from "viem";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "../../tests/vitest-fixtures";
import type { FrakContextV1, FrakContextV2 } from "../types";
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

    describe("V2 context", () => {
        const v2Context: FrakContextV2 = {
            v: 2,
            c: "test-client-id-uuid",
            m: "merchant-uuid-1234",
            t: 1709654400,
        };

        describe("compress", () => {
            it("should compress v2 context with all fields", () => {
                const result = FrakContextManager.compress(v2Context);

                expect(result).toBeDefined();
                expect(typeof result).toBe("string");
                expect(result?.length).toBeGreaterThan(0);
                expect(result).not.toMatch(/[+/=]/);
            });

            it("should return undefined when v2 context has neither clientId nor wallet", () => {
                const partial = { v: 2 as const, m: "m", t: 123 };
                const result = FrakContextManager.compress(
                    partial as FrakContextV2
                );
                expect(result).toBeUndefined();
            });

            it("should compress v2 context with wallet only (no clientId)", () => {
                const v2WithWalletOnly: FrakContextV2 = {
                    v: 2,
                    m: "merchant-uuid-1234",
                    t: 1709654400,
                    w: "0x1234567890123456789012345678901234567890" as Address,
                };
                const result = FrakContextManager.compress(v2WithWalletOnly);
                expect(result).toBeDefined();
                const decompressed = FrakContextManager.decompress(result);
                expect(decompressed).toEqual(v2WithWalletOnly);
            });

            it("should compress v2 context with both clientId and wallet", () => {
                const v2Hybrid: FrakContextV2 = {
                    v: 2,
                    c: "test-client-id-uuid",
                    m: "merchant-uuid-1234",
                    t: 1709654400,
                    w: "0x1234567890123456789012345678901234567890" as Address,
                };
                const result = FrakContextManager.compress(v2Hybrid);
                expect(result).toBeDefined();
                const decompressed = FrakContextManager.decompress(result);
                expect(decompressed).toEqual(v2Hybrid);
            });

            it("should return undefined when v2 context is missing merchantId", () => {
                const partial = { v: 2 as const, c: "c", t: 123 };
                const result = FrakContextManager.compress(
                    partial as FrakContextV2
                );
                expect(result).toBeUndefined();
            });

            it("should return undefined when v2 context is missing timestamp", () => {
                const partial = { v: 2 as const, c: "c", m: "m" };
                const result = FrakContextManager.compress(
                    partial as FrakContextV2
                );
                expect(result).toBeUndefined();
            });
        });

        describe("decompress", () => {
            it("should round-trip compress and decompress v2 context", () => {
                const compressed = FrakContextManager.compress(v2Context);
                const decompressed = FrakContextManager.decompress(compressed);

                expect(decompressed).toEqual(v2Context);
            });
        });

        describe("parse", () => {
            it("should parse URL with v2 fCtx parameter", () => {
                const compressed = FrakContextManager.compress(v2Context);
                const url = `https://example.com?fCtx=${compressed}`;

                const result = FrakContextManager.parse({ url });

                expect(result).toBeDefined();
                expect(result).toHaveProperty("v", 2);
                const v2 = result as FrakContextV2;
                expect(v2.c).toBe("test-client-id-uuid");
                expect(v2.m).toBe("merchant-uuid-1234");
                expect(v2.t).toBe(1709654400);
            });
        });

        describe("update", () => {
            it("should add v2 fCtx to URL", () => {
                const url = "https://example.com";

                const result = FrakContextManager.update({
                    url,
                    context: v2Context,
                });

                expect(result).toBeDefined();
                expect(result).toContain("fCtx=");
                expect(result).toContain("https://example.com");

                const parsed = FrakContextManager.parse({ url: result! });
                expect(parsed).toEqual(v2Context);
            });

            it("should preserve other URL parameters", () => {
                const url = "https://example.com?foo=bar&baz=qux";

                const result = FrakContextManager.update({
                    url,
                    context: v2Context,
                });

                expect(result).toContain("foo=bar");
                expect(result).toContain("baz=qux");
                expect(result).toContain("fCtx=");
            });

            describe("update with attribution", () => {
                const url = "https://example.com/product";

                it("should apply default attribution params when attribution is omitted", () => {
                    const result = FrakContextManager.update({
                        url,
                        context: v2Context,
                    });

                    expect(result).toBeDefined();
                    expect(result).toContain("fCtx=");
                    const parsedUrl = new URL(result!);
                    expect(parsedUrl.searchParams.get("utm_source")).toBe(
                        "frak"
                    );
                    expect(parsedUrl.searchParams.get("utm_medium")).toBe(
                        "referral"
                    );
                    expect(parsedUrl.searchParams.get("utm_campaign")).toBe(
                        v2Context.m
                    );
                    expect(parsedUrl.searchParams.get("via")).toBe("frak");
                    expect(parsedUrl.searchParams.get("ref")).toBe(v2Context.c);
                });

                it("should apply default attribution params when attribution is an empty object", () => {
                    const result = FrakContextManager.update({
                        url,
                        context: v2Context,
                        attribution: {},
                    });

                    expect(result).toBeDefined();
                    const parsedUrl = new URL(result!);
                    expect(parsedUrl.searchParams.get("utm_source")).toBe(
                        "frak"
                    );
                    expect(parsedUrl.searchParams.get("utm_medium")).toBe(
                        "referral"
                    );
                    expect(parsedUrl.searchParams.get("utm_campaign")).toBe(
                        v2Context.m
                    );
                    expect(parsedUrl.searchParams.get("via")).toBe("frak");
                    expect(parsedUrl.searchParams.get("ref")).toBe(v2Context.c);
                    expect(
                        parsedUrl.searchParams.get("utm_content")
                    ).toBeNull();
                    expect(parsedUrl.searchParams.get("utm_term")).toBeNull();
                });

                it("should honor overrides over defaults", () => {
                    const result = FrakContextManager.update({
                        url,
                        context: v2Context,
                        attribution: {
                            utmSource: "newsletter",
                            utmMedium: "email",
                            utmCampaign: "spring-sale",
                            utmContent: "hero-banner",
                            utmTerm: "wallet",
                            via: "partner",
                            ref: "alice",
                        },
                    });

                    const parsedUrl = new URL(result!);
                    expect(parsedUrl.searchParams.get("utm_source")).toBe(
                        "newsletter"
                    );
                    expect(parsedUrl.searchParams.get("utm_medium")).toBe(
                        "email"
                    );
                    expect(parsedUrl.searchParams.get("utm_campaign")).toBe(
                        "spring-sale"
                    );
                    expect(parsedUrl.searchParams.get("utm_content")).toBe(
                        "hero-banner"
                    );
                    expect(parsedUrl.searchParams.get("utm_term")).toBe(
                        "wallet"
                    );
                    expect(parsedUrl.searchParams.get("via")).toBe("partner");
                    expect(parsedUrl.searchParams.get("ref")).toBe("alice");
                });

                it("should preserve merchant-provided UTMs on the base URL (gap-fill)", () => {
                    const baseUrl =
                        "https://example.com/product?utm_source=google&utm_campaign=merchant-spring";
                    const result = FrakContextManager.update({
                        url: baseUrl,
                        context: v2Context,
                        attribution: {},
                    });

                    const parsedUrl = new URL(result!);
                    // Merchant-provided values preserved
                    expect(parsedUrl.searchParams.get("utm_source")).toBe(
                        "google"
                    );
                    expect(parsedUrl.searchParams.get("utm_campaign")).toBe(
                        "merchant-spring"
                    );
                    // Missing ones filled by Frak defaults
                    expect(parsedUrl.searchParams.get("utm_medium")).toBe(
                        "referral"
                    );
                    expect(parsedUrl.searchParams.get("ref")).toBe(v2Context.c);
                });

                it("should skip fields with empty-string overrides", () => {
                    const result = FrakContextManager.update({
                        url,
                        context: v2Context,
                        attribution: { utmContent: "", utmTerm: "" },
                    });

                    const parsedUrl = new URL(result!);
                    expect(parsedUrl.searchParams.has("utm_content")).toBe(
                        false
                    );
                    expect(parsedUrl.searchParams.has("utm_term")).toBe(false);
                });

                it("should skip context-derived defaults for V1 (no merchantId/clientId)", () => {
                    const v1Context: FrakContextV1 = {
                        r: "0x1234567890123456789012345678901234567890" as Address,
                    };
                    const result = FrakContextManager.update({
                        url,
                        context: v1Context,
                        attribution: {},
                    });

                    const parsedUrl = new URL(result!);
                    // Static defaults still applied
                    expect(parsedUrl.searchParams.get("utm_source")).toBe(
                        "frak"
                    );
                    expect(parsedUrl.searchParams.get("utm_medium")).toBe(
                        "referral"
                    );
                    expect(parsedUrl.searchParams.get("via")).toBe("frak");
                    // No derivable values from V1
                    expect(parsedUrl.searchParams.has("utm_campaign")).toBe(
                        false
                    );
                    expect(parsedUrl.searchParams.has("ref")).toBe(false);
                });
            });
        });
    });

    describe("V1 backward compatibility", () => {
        describe("compress", () => {
            it("should compress context with referrer address", () => {
                const context: FrakContextV1 = {
                    r: "0x1234567890123456789012345678901234567890" as Address,
                };

                const result = FrakContextManager.compress(context);

                expect(result).toBeDefined();
                expect(typeof result).toBe("string");
                expect(result?.length).toBeGreaterThan(0);
                expect(result).not.toMatch(/[+/=]/);
            });

            it("should return undefined when context has no referrer", () => {
                const context = {} as FrakContextV1;

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
            it("should decompress valid v1 base64url context", () => {
                const originalContext: FrakContextV1 = {
                    r: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Address,
                };
                const compressed = FrakContextManager.compress(originalContext);

                const result = FrakContextManager.decompress(compressed);

                expect(result).toBeDefined();
                expect((result as FrakContextV1).r).toBe(
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

            it("should round-trip compress and decompress v1", () => {
                const original: FrakContextV1 = {
                    r: "0x1234567890123456789012345678901234567890" as Address,
                };

                const compressed = FrakContextManager.compress(original);
                const decompressed = FrakContextManager.decompress(compressed);

                expect(decompressed).toEqual(original);
            });
        });

        describe("parse", () => {
            it("should parse URL with v1 fCtx parameter", () => {
                const context: FrakContextV1 = {
                    r: "0x1234567890123456789012345678901234567890" as Address,
                };
                const compressed = FrakContextManager.compress(context);
                const url = `https://example.com?fCtx=${compressed}`;

                const result = FrakContextManager.parse({ url });

                expect(result).toBeDefined();
                expect((result as FrakContextV1).r).toBe(
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
                const context: FrakContextV1 = {
                    r: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Address,
                };
                const compressed = FrakContextManager.compress(context);
                const url = `https://example.com?foo=bar&fCtx=${compressed}&baz=qux`;

                const result = FrakContextManager.parse({ url });

                expect(result).toBeDefined();
                expect((result as FrakContextV1).r).toBe(
                    "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"
                );
            });

            it("should return undefined for malformed fCtx parameter", () => {
                const url = "https://example.com?fCtx=!!!invalid!!!";

                const result = FrakContextManager.parse({ url });

                expect(result).toBeUndefined();
            });
        });

        describe("update", () => {
            it("should add v1 fCtx to URL without existing context", () => {
                const url = "https://example.com";
                const context: FrakContextV1 = {
                    r: "0x1234567890123456789012345678901234567890" as Address,
                };

                const result = FrakContextManager.update({ url, context });

                expect(result).toBeDefined();
                expect(result).toContain("fCtx=");
                expect(result).toContain("https://example.com");
            });

            it("should return null when URL is undefined", () => {
                const context: FrakContextV1 = {
                    r: "0x1234567890123456789012345678901234567890" as Address,
                };

                const result = FrakContextManager.update({
                    url: undefined,
                    context,
                });

                expect(result).toBeNull();
            });

            it("should return null when context has no data", () => {
                const url = "https://example.com";
                // Runtime robustness: invalid object shape should return null.
                const context = {} as any;

                const result = FrakContextManager.update({ url, context });

                expect(result).toBeNull();
            });

            it("should preserve other URL parameters", () => {
                const url = "https://example.com?foo=bar&baz=qux";
                const context: FrakContextV1 = {
                    r: "0x1234567890123456789012345678901234567890" as Address,
                };

                const result = FrakContextManager.update({ url, context });

                expect(result).toContain("foo=bar");
                expect(result).toContain("baz=qux");
                expect(result).toContain("fCtx=");
            });

            it("should preserve URL hash", () => {
                const url = "https://example.com#section";
                const context: FrakContextV1 = {
                    r: "0x1234567890123456789012345678901234567890" as Address,
                };

                const result = FrakContextManager.update({ url, context });

                expect(result).toContain("#section");
                expect(result).toContain("fCtx=");
            });
        });
    });

    describe("remove", () => {
        it("should remove fCtx parameter from URL", () => {
            const context: FrakContextV1 = {
                r: "0x1234567890123456789012345678901234567890" as Address,
            };
            const compressed = FrakContextManager.compress(context);
            const url = `https://example.com?fCtx=${compressed}`;

            const result = FrakContextManager.remove(url);

            expect(result).toBe("https://example.com/");
            expect(result).not.toContain("fCtx");
        });

        it("should preserve other parameters when removing fCtx", () => {
            const context: FrakContextV1 = {
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
        const mockAddress =
            "0x1234567890123456789012345678901234567890" as Address;

        beforeEach(() => {
            Object.defineProperty(window, "location", {
                writable: true,
                value: {
                    href: "https://example.com/page",
                },
            });

            mockWindowHistory(vi);
        });

        it("should update window.location with v1 context", () => {
            const url = "https://example.com/test";
            const context: FrakContextV1 = { r: mockAddress };

            FrakContextManager.replaceUrl({ url, context });

            const historySpy = vi.mocked(window.history.replaceState);
            expect(historySpy).toHaveBeenCalledTimes(1);
            expect(historySpy).toHaveBeenCalledWith(
                null,
                "",
                expect.stringContaining("fCtx=")
            );

            const calledUrl = historySpy.mock.calls[0]?.[2] as string;
            expect(calledUrl).toContain("https://example.com/test");
            expect(calledUrl).toContain("fCtx=");
        });

        it("should update window.location with v2 context", () => {
            const url = "https://example.com/test";
            const context: FrakContextV2 = {
                v: 2,
                c: "client-id",
                m: "merchant-id",
                t: 1709654400,
            };

            FrakContextManager.replaceUrl({ url, context });

            const historySpy = vi.mocked(window.history.replaceState);
            expect(historySpy).toHaveBeenCalledTimes(1);

            const calledUrl = historySpy.mock.calls[0]?.[2] as string;
            expect(calledUrl).toContain("fCtx=");

            const parsed = FrakContextManager.parse({ url: calledUrl });
            expect(parsed).toEqual(context);
        });

        it("should use provided URL instead of window.location.href", () => {
            const customUrl = "https://custom.com/path";
            const context: FrakContextV1 = { r: mockAddress };

            FrakContextManager.replaceUrl({ url: customUrl, context });

            const historySpy = vi.mocked(window.history.replaceState);
            const calledUrl = historySpy.mock.calls[0]?.[2] as string;

            expect(calledUrl).toContain("https://custom.com/path");
            expect(calledUrl).not.toContain("https://example.com/page");
        });

        it("should remove fCtx when context is null", () => {
            const url = "https://example.com/test?fCtx=existing";

            FrakContextManager.replaceUrl({ url, context: null });

            const historySpy = vi.mocked(window.history.replaceState);
            expect(historySpy).toHaveBeenCalledTimes(1);

            const calledUrl = historySpy.mock.calls[0]?.[2] as string;
            expect(calledUrl).not.toContain("fCtx=");
        });

        it("should not call replaceState when context has no data", () => {
            const url = "https://example.com/test";
            const context = {} as FrakContextV1;

            FrakContextManager.replaceUrl({ url, context });

            const historySpy = vi.mocked(window.history.replaceState);
            expect(historySpy).not.toHaveBeenCalled();
        });

        it("should handle missing window gracefully", () => {
            Object.defineProperty(window, "location", {
                writable: true,
                value: undefined,
            });

            const url = "https://example.com/test";
            const context: FrakContextV1 = { r: mockAddress };

            expect(() => {
                FrakContextManager.replaceUrl({ url, context });
            }).not.toThrow();

            const historySpy = vi.mocked(window.history.replaceState);
            expect(historySpy).not.toHaveBeenCalled();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "No window found, can't update context"
            );
        });
    });
});
