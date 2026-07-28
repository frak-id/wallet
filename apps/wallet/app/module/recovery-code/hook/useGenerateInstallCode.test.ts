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
