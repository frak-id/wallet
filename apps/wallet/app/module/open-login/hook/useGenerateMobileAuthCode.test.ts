import { renderHook, waitFor } from "@testing-library/react";
import type { Hex } from "viem";
import { vi } from "vitest";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
} from "@/tests/vitest-fixtures";
import { useGenerateMobileAuthCode } from "./useGenerateMobileAuthCode";

vi.mock("@frak-labs/wallet-shared", async (importOriginal) => {
    const original =
        await importOriginal<typeof import("@frak-labs/wallet-shared")>();
    return {
        ...original,
        authenticatedWalletApi: {
            auth: {
                mobile: {
                    code: {
                        post: vi.fn(),
                    },
                },
            },
        },
    };
});

describe("useGenerateMobileAuthCode", () => {
    const mockProductId: Hex = "0x1234567890abcdef";
    const mockReturnOrigin = "https://partner-site.com";

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    test("should initialize with correct default state", async ({
        queryWrapper,
    }) => {
        const { result } = renderHook(() => useGenerateMobileAuthCode(), {
            wrapper: queryWrapper.wrapper,
        });

        expect(result.current.isGenerating).toBe(false);
        expect(result.current.isSuccess).toBe(false);
        expect(result.current.isError).toBe(false);
        expect(result.current.generateAuthCode).toBeDefined();
    });

    test("should generate auth code successfully", async ({ queryWrapper }) => {
        const { authenticatedWalletApi } = await import(
            "@frak-labs/wallet-shared"
        );

        const mockAuthCode = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mockPayload";

        vi.mocked(
            authenticatedWalletApi.auth.mobile.code.post
        ).mockResolvedValue({
            data: { authCode: mockAuthCode },
            error: null,
        } as unknown as Awaited<
            ReturnType<typeof authenticatedWalletApi.auth.mobile.code.post>
        >);

        const { result } = renderHook(() => useGenerateMobileAuthCode(), {
            wrapper: queryWrapper.wrapper,
        });

        const response = await result.current.generateAuthCode({
            productId: mockProductId,
            returnOrigin: mockReturnOrigin,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(response.authCode).toBe(mockAuthCode);
        expect(
            authenticatedWalletApi.auth.mobile.code.post
        ).toHaveBeenCalledWith({
            productId: mockProductId,
            returnOrigin: mockReturnOrigin,
        });
    });

    test("should handle API error", async ({ queryWrapper }) => {
        const { authenticatedWalletApi } = await import(
            "@frak-labs/wallet-shared"
        );

        vi.mocked(
            authenticatedWalletApi.auth.mobile.code.post
        ).mockResolvedValue({
            data: null,
            error: new Error("Failed to generate auth code"),
        } as unknown as Awaited<
            ReturnType<typeof authenticatedWalletApi.auth.mobile.code.post>
        >);

        const { result } = renderHook(() => useGenerateMobileAuthCode(), {
            wrapper: queryWrapper.wrapper,
        });

        await expect(
            result.current.generateAuthCode({
                productId: mockProductId,
                returnOrigin: mockReturnOrigin,
            })
        ).rejects.toThrow();

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });
    });

    test("should set isGenerating while request is in progress", async ({
        queryWrapper,
    }) => {
        const { authenticatedWalletApi } = await import(
            "@frak-labs/wallet-shared"
        );

        let resolvePromise: (value: unknown) => void;
        const pendingPromise = new Promise((resolve) => {
            resolvePromise = resolve;
        });

        vi.mocked(authenticatedWalletApi.auth.mobile.code.post).mockReturnValue(
            pendingPromise as ReturnType<
                typeof authenticatedWalletApi.auth.mobile.code.post
            >
        );

        const { result } = renderHook(() => useGenerateMobileAuthCode(), {
            wrapper: queryWrapper.wrapper,
        });

        const generatePromise = result.current.generateAuthCode({
            productId: mockProductId,
            returnOrigin: mockReturnOrigin,
        });

        await waitFor(() => {
            expect(result.current.isGenerating).toBe(true);
        });

        resolvePromise!({
            data: { authCode: "mock-code" },
            error: null,
        });

        await generatePromise;

        await waitFor(() => {
            expect(result.current.isGenerating).toBe(false);
        });
    });
});
