/**
 * Tests for usePrepareSso hook
 * Tests TanStack Query wrapper for preparing SSO URLs
 */

import { vi } from "vitest";

vi.mock("@frak-labs/core-sdk/actions");

import type { PrepareSsoReturnType } from "@frak-labs/core-sdk";
import { prepareSso } from "@frak-labs/core-sdk/actions";
import { ClientNotFound } from "@frak-labs/frame-connector";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, test } from "../../tests/vitest-fixtures";
import { usePrepareSso } from "./usePrepareSso";

describe("usePrepareSso", () => {
    test("should throw ClientNotFound when client is not available", async ({
        queryWrapper,
    }) => {
        const { result } = renderHook(
            () => usePrepareSso({ directExit: true }),
            {
                wrapper: queryWrapper.wrapper,
            }
        );

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeInstanceOf(ClientNotFound);
    });

    test("should prepare SSO URL successfully", async ({
        mockFrakProviders,
    }) => {
        const mockSsoResult: PrepareSsoReturnType = {
            ssoUrl: "https://wallet-test.frak.id/sso?params=xyz",
        };

        vi.mocked(prepareSso).mockResolvedValue(mockSsoResult);

        const { result } = renderHook(
            () => usePrepareSso({ directExit: true }),
            {
                wrapper: mockFrakProviders,
            }
        );

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual(mockSsoResult);
        expect(result.current.data?.ssoUrl).toContain("sso");
    });

    test("should handle SSO params with redirectUrl", async ({
        mockFrakProviders,
    }) => {
        const mockSsoResult: PrepareSsoReturnType = {
            ssoUrl: "https://wallet-test.frak.id/sso?redirect=example.com",
        };

        vi.mocked(prepareSso).mockResolvedValue(mockSsoResult);

        const { result } = renderHook(
            () =>
                usePrepareSso({
                    redirectUrl: "https://example.com/callback",
                    directExit: false,
                }),
            {
                wrapper: mockFrakProviders,
            }
        );

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual(mockSsoResult);
        expect(prepareSso).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                redirectUrl: "https://example.com/callback",
                directExit: false,
            })
        );
    });

    test("should handle SSO params with metadata", async ({
        mockFrakProviders,
    }) => {
        const mockSsoResult: PrepareSsoReturnType = {
            ssoUrl: "https://wallet-test.frak.id/sso?metadata=xyz",
        };

        vi.mocked(prepareSso).mockResolvedValue(mockSsoResult);

        const { result } = renderHook(
            () =>
                usePrepareSso({
                    metadata: {
                        logoUrl: "https://example.com/logo.png",
                        homepageLink: "https://example.com",
                    },
                    directExit: true,
                }),
            {
                wrapper: mockFrakProviders,
            }
        );

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual(mockSsoResult);
    });

    test("should handle RPC errors", async ({ mockFrakProviders }) => {
        const error = new Error("SSO preparation failed");
        vi.mocked(prepareSso).mockRejectedValue(error);

        const { result } = renderHook(
            () => usePrepareSso({ directExit: true }),
            {
                wrapper: mockFrakProviders,
            }
        );

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toEqual(error);
    });

    test("should update query key with params", async ({
        mockFrakProviders,
    }) => {
        const mockSsoResult: PrepareSsoReturnType = {
            ssoUrl: "https://wallet-test.frak.id/sso?params=abc",
        };

        vi.mocked(prepareSso).mockResolvedValue(mockSsoResult);

        const params = {
            directExit: false,
            redirectUrl: "https://example.com",
        };

        const { result, rerender } = renderHook(() => usePrepareSso(params), {
            wrapper: mockFrakProviders,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual(mockSsoResult);

        // Query key includes params, so changes should trigger re-fetch
        rerender();
        expect(result.current.data).toEqual(mockSsoResult);
    });

    test("should call prepareSso with client and params", async ({
        mockFrakProviders,
        mockFrakClient,
    }) => {
        const mockSsoResult: PrepareSsoReturnType = {
            ssoUrl: "https://wallet-test.frak.id/sso?test=123",
        };

        vi.mocked(prepareSso).mockResolvedValue(mockSsoResult);

        const params = {
            directExit: true,
            metadata: {
                logoUrl: "https://example.com/logo.png",
            },
        };

        const { result } = renderHook(() => usePrepareSso(params), {
            wrapper: mockFrakProviders,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(prepareSso).toHaveBeenCalledWith(mockFrakClient, params);
    });
});
