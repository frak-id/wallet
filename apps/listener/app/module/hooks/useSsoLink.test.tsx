import { renderHook } from "@testing-library/react";
import type { Hex } from "viem";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { useSsoLink } from "./useSsoLink";

vi.mock("@frak-labs/core-sdk", () => ({
    generateSsoUrl: vi.fn(),
}));

describe("useSsoLink", () => {
    const mockMerchantId = "0x1234" as Hex;
    const mockMetadata = {
        name: "Test App",
        css: "body { color: blue; }",
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    test("should generate SSO link with all parameters", async () => {
        const { generateSsoUrl } = await import("@frak-labs/core-sdk");

        vi.mocked(generateSsoUrl).mockReturnValue(
            "https://wallet.frak.id/sso?productId=0x1234&name=Test%20App"
        );

        const { result } = renderHook(() =>
            useSsoLink({
                merchantId: mockMerchantId,
                metadata: mockMetadata,
                directExit: true,
                redirectUrl: "https://example.com/callback",
                lang: "en",
            })
        );

        expect(result.current.link).toBe(
            "https://wallet.frak.id/sso?productId=0x1234&name=Test%20App"
        );

        expect(generateSsoUrl).toHaveBeenCalledWith(
            window.location.origin,
            {
                directExit: true,
                redirectUrl: "https://example.com/callback",
                metadata: mockMetadata,
                lang: "en",
            },
            mockMerchantId,
            mockMetadata.name,
            mockMetadata.css,
            undefined
        );
    });

    test("should generate SSO link without optional parameters", async () => {
        const { generateSsoUrl } = await import("@frak-labs/core-sdk");

        vi.mocked(generateSsoUrl).mockReturnValue(
            "https://wallet.frak.id/sso?productId=0x1234"
        );

        const { result } = renderHook(() =>
            useSsoLink({
                merchantId: mockMerchantId,
                metadata: mockMetadata,
            })
        );

        expect(result.current.link).toBe(
            "https://wallet.frak.id/sso?productId=0x1234"
        );

        expect(generateSsoUrl).toHaveBeenCalledWith(
            window.location.origin,
            {
                directExit: undefined,
                redirectUrl: undefined,
                metadata: mockMetadata,
                lang: undefined,
            },
            mockMerchantId,
            mockMetadata.name,
            mockMetadata.css,
            undefined
        );
    });

    test("should regenerate link when merchantId changes", async () => {
        const { generateSsoUrl } = await import("@frak-labs/core-sdk");

        vi.mocked(generateSsoUrl)
            .mockReturnValueOnce("https://wallet.frak.id/sso?productId=0x1234")
            .mockReturnValueOnce("https://wallet.frak.id/sso?productId=0x5678");

        const { result, rerender } = renderHook(
            ({ merchantId }: { merchantId: Hex }) =>
                useSsoLink({
                    merchantId,
                    metadata: mockMetadata,
                }),
            {
                initialProps: { merchantId: mockMerchantId },
            }
        );

        expect(result.current.link).toBe(
            "https://wallet.frak.id/sso?productId=0x1234"
        );

        rerender({ merchantId: "0x5678" as Hex });

        expect(result.current.link).toBe(
            "https://wallet.frak.id/sso?productId=0x5678"
        );

        expect(generateSsoUrl).toHaveBeenCalledTimes(2);
    });

    test("should handle French language parameter", async () => {
        const { generateSsoUrl } = await import("@frak-labs/core-sdk");

        vi.mocked(generateSsoUrl).mockReturnValue(
            "https://wallet.frak.id/sso?productId=0x1234&lang=fr"
        );

        const { result } = renderHook(() =>
            useSsoLink({
                merchantId: mockMerchantId,
                metadata: mockMetadata,
                lang: "fr",
            })
        );

        expect(result.current.link).toBe(
            "https://wallet.frak.id/sso?productId=0x1234&lang=fr"
        );

        expect(generateSsoUrl).toHaveBeenCalledWith(
            window.location.origin,
            {
                directExit: undefined,
                redirectUrl: undefined,
                metadata: mockMetadata,
                lang: "fr",
            },
            mockMerchantId,
            mockMetadata.name,
            mockMetadata.css,
            undefined
        );
    });

    test("should memoize the link when dependencies don't change", async () => {
        const { generateSsoUrl } = await import("@frak-labs/core-sdk");

        vi.mocked(generateSsoUrl).mockReturnValue(
            "https://wallet.frak.id/sso?productId=0x1234"
        );

        const { result, rerender } = renderHook(() =>
            useSsoLink({
                merchantId: mockMerchantId,
                metadata: mockMetadata,
            })
        );

        const firstLink = result.current.link;

        rerender();

        expect(result.current.link).toBe(firstLink);
        expect(generateSsoUrl).toHaveBeenCalledTimes(1);
    });
});
