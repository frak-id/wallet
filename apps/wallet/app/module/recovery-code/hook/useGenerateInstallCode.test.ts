/** @jsxImportSource react */
import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

const mockGeneratePost = vi.fn();

vi.mock("@frak-labs/wallet-shared", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("@frak-labs/wallet-shared")>();
    return {
        ...actual,
        authenticatedBackendApi: {
            user: {
                identity: {
                    "install-code": {
                        generate: {
                            post: mockGeneratePost,
                        },
                    },
                },
            },
        },
    };
});

/**
 * Every test imports the hook dynamically: a static import would bind the
 * module before `vi.mock` above has replaced `authenticatedBackendApi`.
 */
describe("useGenerateInstallCode", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGeneratePost.mockResolvedValue({
            data: { code: "ABC123", expiresAt: "2024-01-01T00:00:00.000Z" },
            error: null,
        });
    });

    test("forwards the proof when present", async ({ queryWrapper }) => {
        const { useGenerateInstallCode } = await import(
            "./useGenerateInstallCode"
        );
        renderHook(
            () =>
                useGenerateInstallCode({
                    merchantId: "merchant-1",
                    anonymousId: "anon-1",
                    proof: "install-proof",
                }),
            { wrapper: queryWrapper.wrapper }
        );

        await waitFor(() => {
            expect(mockGeneratePost).toHaveBeenCalledWith({
                merchantId: "merchant-1",
                anonymousId: "anon-1",
                proof: "install-proof",
            });
        });
    });

    test("fires on a token-only call, where there is no anonymousId at all", async ({
        queryWrapper,
    }) => {
        const { useGenerateInstallCode } = await import(
            "./useGenerateInstallCode"
        );
        renderHook(
            () =>
                useGenerateInstallCode({
                    merchantId: "merchant-3",
                    checkoutToken: "tok-3",
                }),
            { wrapper: queryWrapper.wrapper }
        );

        await waitFor(() => {
            expect(mockGeneratePost).toHaveBeenCalledWith({
                merchantId: "merchant-3",
                checkoutToken: "tok-3",
            });
        });
    });

    test("prefers the order-derived token over the buyer-writable id", async ({
        queryWrapper,
    }) => {
        const { useGenerateInstallCode } = await import(
            "./useGenerateInstallCode"
        );
        renderHook(
            () =>
                useGenerateInstallCode({
                    merchantId: "merchant-4",
                    anonymousId: "anon-4",
                    checkoutToken: "tok-4",
                    proof: "install-proof",
                }),
            { wrapper: queryWrapper.wrapper }
        );

        await waitFor(() => {
            expect(mockGeneratePost).toHaveBeenCalledWith({
                merchantId: "merchant-4",
                checkoutToken: "tok-4",
            });
        });
    });

    test("resolves to null on a refused credential instead of throwing", async ({
        queryWrapper,
    }) => {
        mockGeneratePost.mockResolvedValue({
            data: null,
            error: { status: 404, value: { code: "MERCHANT_NOT_CONFIGURED" } },
        });
        const { useGenerateInstallCode } = await import(
            "./useGenerateInstallCode"
        );
        const { result } = renderHook(
            () =>
                useGenerateInstallCode({
                    merchantId: "merchant-6",
                    checkoutToken: "tok-6",
                }),
            { wrapper: queryWrapper.wrapper }
        );

        await waitFor(() => {
            expect(result.current.status).toBe("success");
        });
        expect(result.current.data).toBeNull();
        expect(result.current.error).toBeNull();
    });

    test("still surfaces a server failure as an error", async ({
        queryWrapper,
    }) => {
        mockGeneratePost.mockResolvedValue({
            data: null,
            error: { status: 500, value: null },
        });
        const { useGenerateInstallCode } = await import(
            "./useGenerateInstallCode"
        );
        const { result } = renderHook(
            () =>
                useGenerateInstallCode({
                    merchantId: "merchant-7",
                    checkoutToken: "tok-7",
                    // Assert the terminal state, not the backoff schedule.
                    retry: false,
                }),
            { wrapper: queryWrapper.wrapper }
        );

        await waitFor(() => {
            expect(result.current.status).toBe("error");
        });
    });

    test("retries a 5xx on the production default and resolves with the retry's code", async ({
        queryWrapper,
    }) => {
        mockGeneratePost
            .mockResolvedValueOnce({ data: null, error: { status: 503 } })
            .mockResolvedValueOnce({
                data: { code: "RETRY123", expiresAt: "2026-01-01T00:00:00Z" },
                error: null,
            });
        const { useGenerateInstallCode } = await import(
            "./useGenerateInstallCode"
        );
        const { result } = renderHook(
            () =>
                useGenerateInstallCode({
                    merchantId: "merchant-8",
                    checkoutToken: "tok-8",
                    // No `retry` override: this asserts the shipped default.
                }),
            { wrapper: queryWrapper.wrapper }
        );

        await waitFor(() => expect(result.current.status).toBe("success"), {
            timeout: 5000,
        });
        expect(result.current.data?.code).toBe("RETRY123");
        expect(mockGeneratePost).toHaveBeenCalledTimes(2);
    });

    test("never retries a 4xx, so a refusal stays one request", async ({
        queryWrapper,
    }) => {
        mockGeneratePost.mockResolvedValue({
            data: null,
            error: { status: 404, value: { code: "MERCHANT_NOT_CONFIGURED" } },
        });
        const { useGenerateInstallCode } = await import(
            "./useGenerateInstallCode"
        );
        const { result } = renderHook(
            () =>
                useGenerateInstallCode({
                    merchantId: "merchant-9",
                    checkoutToken: "tok-9",
                }),
            { wrapper: queryWrapper.wrapper }
        );

        await waitFor(() => expect(result.current.status).toBe("success"));
        expect(result.current.data).toBeNull();
        expect(mockGeneratePost).toHaveBeenCalledTimes(1);
    });

    test("stays disabled with neither credential", async ({ queryWrapper }) => {
        const { useGenerateInstallCode } = await import(
            "./useGenerateInstallCode"
        );
        renderHook(() => useGenerateInstallCode({ merchantId: "merchant-5" }), {
            wrapper: queryWrapper.wrapper,
        });

        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(mockGeneratePost).not.toHaveBeenCalled();
    });

    test("keys a token-only call apart from an id-only one", async () => {
        const { installCodeKey } = await import(
            "@/module/recovery-code/queryKeys/install-code"
        );
        expect(
            installCodeKey.generate("merchant-1", undefined, "tok-1")
        ).not.toEqual(installCodeKey.generate("merchant-1", "anon-1"));
    });

    test("degrades to no proof when the fragment was absent", async ({
        queryWrapper,
    }) => {
        const { useGenerateInstallCode } = await import(
            "./useGenerateInstallCode"
        );
        renderHook(
            () =>
                useGenerateInstallCode({
                    merchantId: "merchant-2",
                    anonymousId: "anon-2",
                }),
            { wrapper: queryWrapper.wrapper }
        );

        await waitFor(() => {
            expect(mockGeneratePost).toHaveBeenCalledWith({
                merchantId: "merchant-2",
                anonymousId: "anon-2",
                proof: undefined,
            });
        });
    });
});
