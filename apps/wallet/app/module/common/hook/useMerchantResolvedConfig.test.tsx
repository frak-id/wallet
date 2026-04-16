/** @jsxImportSource react */
import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { useMerchantResolvedConfig } from "@/module/common/hook/useMerchantResolvedConfig";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
} from "@/tests/vitest-fixtures";

vi.mock("@frak-labs/wallet-shared", async (importOriginal) => {
    const actual = await importOriginal<object>();
    return {
        ...actual,
        authenticatedBackendApi: {
            user: {
                merchant: {
                    resolve: {
                        get: vi.fn(),
                    },
                },
            },
        },
    };
});

const merchantId = "11111111-1111-1111-1111-111111111111";

const sampleResponse = {
    merchantId,
    productId: "0xabc" as const,
    name: "Test Merchant",
    domain: "merchant.example",
    allowedDomains: ["merchant.example"],
    sdkConfig: {
        attribution: { utmSource: "newsletter", via: "merchant" },
    },
};

describe("useMerchantResolvedConfig", () => {
    beforeEach(({ queryWrapper }) => {
        queryWrapper.client.clear();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    test("does not fetch when merchantId is missing", async ({
        queryWrapper,
    }) => {
        const { authenticatedBackendApi } = await import(
            "@frak-labs/wallet-shared"
        );
        const resolveGet = vi.mocked(
            authenticatedBackendApi.user.merchant.resolve.get
        );

        renderHook(() => useMerchantResolvedConfig({}), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(resolveGet).not.toHaveBeenCalled();
        });
    });

    test("fetches and returns the full config when merchantId is provided", async ({
        queryWrapper,
    }) => {
        const { authenticatedBackendApi } = await import(
            "@frak-labs/wallet-shared"
        );
        const resolveGet = vi.mocked(
            authenticatedBackendApi.user.merchant.resolve.get
        );
        resolveGet.mockResolvedValue({
            data: sampleResponse,
            error: null,
        } as never);

        const { result } = renderHook(
            () => useMerchantResolvedConfig({ merchantId }),
            { wrapper: queryWrapper.wrapper }
        );

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
            expect(result.current.data).toEqual(sampleResponse);
        });

        expect(resolveGet).toHaveBeenCalledWith({
            query: { merchantId },
        });
    });

    test("forwards lang query parameter when provided", async ({
        queryWrapper,
    }) => {
        const { authenticatedBackendApi } = await import(
            "@frak-labs/wallet-shared"
        );
        const resolveGet = vi.mocked(
            authenticatedBackendApi.user.merchant.resolve.get
        );
        resolveGet.mockResolvedValue({
            data: sampleResponse,
            error: null,
        } as never);

        renderHook(
            () => useMerchantResolvedConfig({ merchantId, lang: "fr" }),
            { wrapper: queryWrapper.wrapper }
        );

        await waitFor(() => {
            expect(resolveGet).toHaveBeenCalledWith({
                query: { merchantId, lang: "fr" },
            });
        });
    });

    test("supports a select function to extract attribution defaults", async ({
        queryWrapper,
    }) => {
        const { authenticatedBackendApi } = await import(
            "@frak-labs/wallet-shared"
        );
        const resolveGet = vi.mocked(
            authenticatedBackendApi.user.merchant.resolve.get
        );
        resolveGet.mockResolvedValue({
            data: sampleResponse,
            error: null,
        } as never);

        const { result } = renderHook(
            () =>
                useMerchantResolvedConfig({
                    merchantId,
                    select: (config) => config?.sdkConfig?.attribution,
                }),
            { wrapper: queryWrapper.wrapper }
        );

        await waitFor(() => {
            expect(result.current.data).toEqual({
                utmSource: "newsletter",
                via: "merchant",
            });
        });
    });

    test("returns null when the API responds with an error", async ({
        queryWrapper,
    }) => {
        const { authenticatedBackendApi } = await import(
            "@frak-labs/wallet-shared"
        );
        const resolveGet = vi.mocked(
            authenticatedBackendApi.user.merchant.resolve.get
        );
        resolveGet.mockResolvedValue({
            data: null,
            error: new Error("not found"),
        } as never);

        const { result } = renderHook(
            () => useMerchantResolvedConfig({ merchantId }),
            { wrapper: queryWrapper.wrapper }
        );

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
            expect(result.current.data).toBeNull();
        });
    });
});
