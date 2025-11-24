/**
 * Tests for SSO URL generation utility
 * Tests generateSsoUrl and compressed parameter formatting
 */

import { vi } from "vitest";

// Mock compression functions
vi.mock("./compression/compress", () => ({
    compressJsonToB64: vi.fn((data: unknown) => {
        // Return base64url-like string for testing
        return `compressed_${JSON.stringify(data)}`;
    }),
}));

import type { Hex } from "viem";
import { describe, expect, it } from "../../tests/vitest-fixtures";
import type { PrepareSsoParamsType } from "../types";
import { compressJsonToB64 } from "./compression/compress";
import { generateSsoUrl } from "./sso";

describe("generateSsoUrl", () => {
    const mockProductId =
        "0x1234567890123456789012345678901234567890123456789012345678901234" as Hex;
    const walletUrl = "https://wallet.frak.id";

    describe("basic URL generation", () => {
        it("should generate SSO URL with basic params", () => {
            const params: PrepareSsoParamsType = {};
            const name = "Test App";

            const result = generateSsoUrl(
                walletUrl,
                params,
                mockProductId,
                name
            );

            expect(result).toContain("https://wallet.frak.id/sso");
            expect(result).toContain("?p=");
        });

        it("should include compressed parameters in URL", () => {
            const params: PrepareSsoParamsType = {
                directExit: true,
            };
            const name = "My App";

            const result = generateSsoUrl(
                walletUrl,
                params,
                mockProductId,
                name
            );

            expect(result).toContain("?p=compressed_");
            expect(compressJsonToB64).toHaveBeenCalled();
        });

        it("should set /sso pathname", () => {
            const params: PrepareSsoParamsType = {};
            const name = "App";

            const result = generateSsoUrl(
                walletUrl,
                params,
                mockProductId,
                name
            );

            const url = new URL(result);
            expect(url.pathname).toBe("/sso");
        });

        it("should preserve wallet base URL", () => {
            const customWalletUrl = "https://custom-wallet.com";
            const params: PrepareSsoParamsType = {};
            const name = "App";

            const result = generateSsoUrl(
                customWalletUrl,
                params,
                mockProductId,
                name
            );

            expect(result).toContain("https://custom-wallet.com/sso");
        });
    });

    describe("parameter compression format", () => {
        it("should compress params with name and productId", () => {
            const params: PrepareSsoParamsType = {};
            const name = "Test App";

            generateSsoUrl(walletUrl, params, mockProductId, name);

            expect(compressJsonToB64).toHaveBeenCalledWith(
                expect.objectContaining({
                    p: mockProductId,
                    m: expect.objectContaining({
                        n: name,
                    }),
                })
            );
        });

        it("should include redirectUrl in compressed params", () => {
            const params: PrepareSsoParamsType = {
                redirectUrl: "https://example.com/callback",
            };
            const name = "App";

            generateSsoUrl(walletUrl, params, mockProductId, name);

            expect(compressJsonToB64).toHaveBeenCalledWith(
                expect.objectContaining({
                    r: "https://example.com/callback",
                })
            );
        });

        it("should include directExit in compressed params", () => {
            const params: PrepareSsoParamsType = {
                directExit: true,
            };
            const name = "App";

            generateSsoUrl(walletUrl, params, mockProductId, name);

            expect(compressJsonToB64).toHaveBeenCalledWith(
                expect.objectContaining({
                    d: true,
                })
            );
        });

        it("should include lang in compressed params", () => {
            const params: PrepareSsoParamsType = {
                lang: "fr",
            };
            const name = "App";

            generateSsoUrl(walletUrl, params, mockProductId, name);

            expect(compressJsonToB64).toHaveBeenCalledWith(
                expect.objectContaining({
                    l: "fr",
                })
            );
        });

        it("should include custom CSS when provided", () => {
            const params: PrepareSsoParamsType = {};
            const name = "App";
            const css = "body { color: red; }";

            generateSsoUrl(walletUrl, params, mockProductId, name, css);

            expect(compressJsonToB64).toHaveBeenCalledWith(
                expect.objectContaining({
                    m: expect.objectContaining({
                        css: "body { color: red; }",
                    }),
                })
            );
        });

        it("should include metadata logoUrl", () => {
            const params: PrepareSsoParamsType = {
                metadata: {
                    logoUrl: "https://example.com/logo.png",
                },
            };
            const name = "App";

            generateSsoUrl(walletUrl, params, mockProductId, name);

            expect(compressJsonToB64).toHaveBeenCalledWith(
                expect.objectContaining({
                    m: expect.objectContaining({
                        l: "https://example.com/logo.png",
                    }),
                })
            );
        });

        it("should include metadata homepageLink", () => {
            const params: PrepareSsoParamsType = {
                metadata: {
                    homepageLink: "https://example.com",
                },
            };
            const name = "App";

            generateSsoUrl(walletUrl, params, mockProductId, name);

            expect(compressJsonToB64).toHaveBeenCalledWith(
                expect.objectContaining({
                    m: expect.objectContaining({
                        h: "https://example.com",
                    }),
                })
            );
        });

        it("should include all metadata fields together", () => {
            const params: PrepareSsoParamsType = {
                metadata: {
                    logoUrl: "https://example.com/logo.png",
                    homepageLink: "https://example.com",
                },
            };
            const name = "Full App";
            const css = "body { background: blue; }";

            generateSsoUrl(walletUrl, params, mockProductId, name, css);

            expect(compressJsonToB64).toHaveBeenCalledWith(
                expect.objectContaining({
                    m: {
                        n: "Full App",
                        css: "body { background: blue; }",
                        l: "https://example.com/logo.png",
                        h: "https://example.com",
                    },
                })
            );
        });
    });

    describe("full parameter combinations", () => {
        it("should handle all parameters together", () => {
            const params: PrepareSsoParamsType = {
                redirectUrl: "https://example.com/callback",
                directExit: false,
                lang: "fr",
                metadata: {
                    logoUrl: "https://example.com/logo.png",
                    homepageLink: "https://example.com/home",
                },
            };
            const name = "Complete App";
            const css = "body { margin: 0; }";

            const result = generateSsoUrl(
                walletUrl,
                params,
                mockProductId,
                name,
                css
            );

            expect(result).toContain("https://wallet.frak.id/sso");
            expect(result).toContain("?p=");
            expect(compressJsonToB64).toHaveBeenCalledWith({
                r: "https://example.com/callback",
                d: false,
                l: "fr",
                p: mockProductId,
                m: {
                    n: "Complete App",
                    css: "body { margin: 0; }",
                    l: "https://example.com/logo.png",
                    h: "https://example.com/home",
                },
            });
        });

        it("should handle minimal parameters", () => {
            const params: PrepareSsoParamsType = {};
            const name = "Minimal App";

            const result = generateSsoUrl(
                walletUrl,
                params,
                mockProductId,
                name
            );

            expect(result).toBeDefined();
            expect(compressJsonToB64).toHaveBeenCalledWith(
                expect.objectContaining({
                    p: mockProductId,
                    m: expect.objectContaining({
                        n: "Minimal App",
                    }),
                })
            );
        });
    });

    describe("edge cases", () => {
        it("should handle empty name", () => {
            const params: PrepareSsoParamsType = {};
            const name = "";

            const result = generateSsoUrl(
                walletUrl,
                params,
                mockProductId,
                name
            );

            expect(result).toBeDefined();
            expect(compressJsonToB64).toHaveBeenCalledWith(
                expect.objectContaining({
                    m: expect.objectContaining({
                        n: "",
                    }),
                })
            );
        });

        it("should handle undefined optional parameters", () => {
            const params: PrepareSsoParamsType = {};
            const name = "App";

            generateSsoUrl(walletUrl, params, mockProductId, name, undefined);

            expect(compressJsonToB64).toHaveBeenCalledWith(
                expect.objectContaining({
                    m: expect.objectContaining({
                        n: "App",
                        css: undefined,
                    }),
                })
            );
        });

        it("should handle wallet URL with trailing slash", () => {
            const walletUrlWithSlash = "https://wallet.frak.id/";
            const params: PrepareSsoParamsType = {};
            const name = "App";

            const result = generateSsoUrl(
                walletUrlWithSlash,
                params,
                mockProductId,
                name
            );

            expect(result).toContain("https://wallet.frak.id/sso");
        });

        it("should handle different product IDs", () => {
            const differentProductId =
                "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdabcdefabcdefabcdefabcd" as Hex;
            const params: PrepareSsoParamsType = {};
            const name = "App";

            generateSsoUrl(walletUrl, params, differentProductId, name);

            expect(compressJsonToB64).toHaveBeenCalledWith(
                expect.objectContaining({
                    p: differentProductId,
                })
            );
        });
    });
});
