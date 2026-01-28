import type { CompressedSsoData } from "@frak-labs/core-sdk";
import type { Hex } from "viem";
import { describe, expect, it } from "vitest";
import { compressedSsoToParams } from "./ssoDataCompression";

describe("ssoDataCompression", () => {
    describe("compressedSsoToParams", () => {
        it("should decompress full SSO data", () => {
            const compressed: CompressedSsoData = {
                r: "https://example.com/callback",
                d: true,
                l: "en",
                m: "0x1234567890abcdef" as Hex,
                md: {
                    n: "Example App",
                    css: "custom-styles.css",
                    l: "https://example.com/logo.png",
                    h: "https://example.com",
                },
            };

            const result = compressedSsoToParams(compressed);

            expect(result).toEqual({
                redirectUrl: "https://example.com/callback",
                directExit: true,
                lang: "en",
                merchantId: "0x1234567890abcdef",
                metadata: {
                    name: "Example App",
                    css: "custom-styles.css",
                    logoUrl: "https://example.com/logo.png",
                    homepageLink: "https://example.com",
                },
            });
        });

        it("should handle minimal SSO data", () => {
            const compressed: CompressedSsoData = {
                r: "https://example.com/callback",
                m: "0x1234567890abcdef" as Hex,
                md: { n: "Minimal App" },
            };

            const result = compressedSsoToParams(compressed);

            expect(result.redirectUrl).toBe("https://example.com/callback");
            expect(result.directExit).toBeUndefined();
            expect(result.lang).toBeUndefined();
            expect(result.merchantId).toBe("0x1234567890abcdef");
            expect(result.metadata.name).toBe("Minimal App");
        });

        it("should handle SSO data without metadata", () => {
            const compressed: CompressedSsoData = {
                r: "https://example.com/callback",
                d: false,
                l: "fr",
                m: "0xabcdef1234567890" as Hex,
                md: { n: "No Metadata App" },
            };

            const result = compressedSsoToParams(compressed);

            expect(result.redirectUrl).toBe("https://example.com/callback");
            expect(result.directExit).toBe(false);
            expect(result.lang).toBe("fr");
            expect(result.merchantId).toBe("0xabcdef1234567890");
            expect(result.metadata.name).toBe("No Metadata App");
        });

        it("should handle partial metadata", () => {
            const compressed: CompressedSsoData = {
                r: "https://example.com/callback",
                m: "0x9876543210fedcba" as Hex,
                md: {
                    n: "Partial App",
                    l: "https://example.com/logo.png",
                },
            };

            const result = compressedSsoToParams(compressed);

            expect(result.metadata).toEqual({
                name: "Partial App",
                css: undefined,
                logoUrl: "https://example.com/logo.png",
                homepageLink: undefined,
            });
        });

        it("should map compressed keys to full parameter names", () => {
            const compressed: CompressedSsoData = {
                r: "redirect-url",
                d: true,
                l: "fr",
                m: "0x1234567890abcdef" as Hex,
                md: {
                    n: "app-name",
                    css: "styles",
                    l: "logo-url",
                    h: "home-url",
                },
            };

            const result = compressedSsoToParams(compressed);

            expect(result.redirectUrl).toBe("redirect-url");
            expect(result.directExit).toBe(true);
            expect(result.lang).toBe("fr");
            expect(result.merchantId).toBe("0x1234567890abcdef");
            expect(result.metadata.name).toBe("app-name");
            expect(result.metadata.css).toBe("styles");
            expect(result.metadata.logoUrl).toBe("logo-url");
            expect(result.metadata.homepageLink).toBe("home-url");
        });

        it("should handle directExit as false", () => {
            const compressed: CompressedSsoData = {
                r: "https://example.com",
                d: false,
                m: "0x1234567890abcdef" as Hex,
                md: { n: "Test App" },
            };

            const result = compressedSsoToParams(compressed);

            expect(result.directExit).toBe(false);
        });

        it("should handle empty metadata object", () => {
            const compressed: CompressedSsoData = {
                r: "https://example.com",
                m: "0x1234567890abcdef" as Hex,
                md: { n: "Test App" },
            };

            const result = compressedSsoToParams(compressed);

            expect(result.metadata.name).toBe("Test App");
        });

        it("should preserve exact values without transformation", () => {
            const compressed: CompressedSsoData = {
                r: "https://example.com/very/long/callback/url?param1=value1&param2=value2",
                d: true,
                l: "en",
                m: "0x1234567890abcdef" as Hex,
                md: {
                    n: "App with Special Chars !@#$%",
                    css: "https://cdn.example.com/styles.css?v=1.2.3",
                    l: "https://cdn.example.com/logo.svg",
                    h: "https://example.com/home?utm_source=sso",
                },
            };

            const result = compressedSsoToParams(compressed);

            expect(result.redirectUrl).toBe(compressed.r);
            expect(result.merchantId).toBe(compressed.m);
            expect(result.metadata.name).toBe(compressed.md?.n);
            expect(result.metadata.css).toBe(compressed.md?.css);
            expect(result.metadata.logoUrl).toBe(compressed.md?.l);
            expect(result.metadata.homepageLink).toBe(compressed.md?.h);
        });
    });
});
