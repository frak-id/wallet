/**
 * Tests for useOpenSso hook
 * Tests TanStack Mutation wrapper for opening SSO
 */

import { vi } from "vitest";

vi.mock("@frak-labs/core-sdk/actions");

import type { OpenSsoReturnType } from "@frak-labs/core-sdk";
import { openSso } from "@frak-labs/core-sdk/actions";
import { ClientNotFound } from "@frak-labs/frame-connector";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, test } from "../../tests/vitest-fixtures";
import { useOpenSso } from "./useOpenSso";

describe("useOpenSso", () => {
    test("should throw ClientNotFound when client is not available", async ({
        queryWrapper,
    }) => {
        const { result } = renderHook(() => useOpenSso(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.mutate).toBeDefined();
        });

        result.current.mutate({});

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeInstanceOf(ClientNotFound);
    });

    test("should open SSO successfully", async ({ mockFrakProviders }) => {
        const mockResult = undefined as unknown as OpenSsoReturnType;

        vi.mocked(openSso).mockResolvedValue(mockResult);

        const { result } = renderHook(() => useOpenSso(), {
            wrapper: mockFrakProviders,
        });

        result.current.mutate({});

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(openSso).toHaveBeenCalledTimes(1);
    });

    test("should open SSO with redirectUrl", async ({ mockFrakProviders }) => {
        const mockResult = undefined as unknown as OpenSsoReturnType;

        vi.mocked(openSso).mockResolvedValue(mockResult);

        const { result } = renderHook(() => useOpenSso(), {
            wrapper: mockFrakProviders,
        });

        const redirectUrl = "https://example.com/callback";

        result.current.mutate({
            redirectUrl,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(openSso).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                redirectUrl,
            })
        );
    });

    test("should open SSO with metadata", async ({ mockFrakProviders }) => {
        const mockResult = undefined as unknown as OpenSsoReturnType;

        vi.mocked(openSso).mockResolvedValue(mockResult);

        const { result } = renderHook(() => useOpenSso(), {
            wrapper: mockFrakProviders,
        });

        const metadata = {
            logoUrl: "https://example.com/logo.png",
            homepageLink: "https://example.com",
        };

        result.current.mutate({
            metadata,
            directExit: true,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(openSso).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                metadata,
                directExit: true,
            })
        );
    });

    test("should handle mutateAsync", async ({ mockFrakProviders }) => {
        const mockResult = undefined as unknown as OpenSsoReturnType;

        vi.mocked(openSso).mockResolvedValue(mockResult);

        const { result } = renderHook(() => useOpenSso(), {
            wrapper: mockFrakProviders,
        });

        await result.current.mutateAsync({
            directExit: false,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });
    });

    test("should handle RPC errors", async ({ mockFrakProviders }) => {
        const error = new Error("SSO open failed");
        vi.mocked(openSso).mockRejectedValue(error);

        const { result } = renderHook(() => useOpenSso(), {
            wrapper: mockFrakProviders,
        });

        result.current.mutate({});

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toEqual(error);
    });

    test("should handle mutation options", async ({ mockFrakProviders }) => {
        const mockResult = undefined as unknown as OpenSsoReturnType;

        vi.mocked(openSso).mockResolvedValue(mockResult);

        const onSuccess = vi.fn();
        const onError = vi.fn();

        const { result } = renderHook(
            () =>
                useOpenSso({
                    mutations: {
                        onSuccess,
                        onError,
                    },
                }),
            {
                wrapper: mockFrakProviders,
            }
        );

        result.current.mutate({});

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(onSuccess).toHaveBeenCalled();
        expect(onError).not.toHaveBeenCalled();
    });

    test("should reset mutation state", async ({ mockFrakProviders }) => {
        const mockResult = undefined as unknown as OpenSsoReturnType;

        vi.mocked(openSso).mockResolvedValue(mockResult);

        const { result } = renderHook(() => useOpenSso(), {
            wrapper: mockFrakProviders,
        });

        result.current.mutate({});

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        result.current.reset();

        await waitFor(() => {
            expect(result.current.isIdle).toBe(true);
        });
    });
});
