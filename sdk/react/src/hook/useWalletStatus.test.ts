/**
 * Tests for useWalletStatus hook
 * Tests TanStack Query wrapper for watching wallet status
 */

import { vi } from "vitest";

vi.mock("@frak-labs/core-sdk/actions");

import type { WalletStatusReturnType } from "@frak-labs/core-sdk";
import { watchWalletStatus } from "@frak-labs/core-sdk/actions";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, test } from "../../tests/vitest-fixtures";
import { useWalletStatus } from "./useWalletStatus";

describe("useWalletStatus", () => {
    test("should be disabled when client is not available", ({
        queryWrapper,
    }) => {
        const { result } = renderHook(() => useWalletStatus(), {
            wrapper: queryWrapper.wrapper,
        });

        // Query should not run when client is not available
        expect(result.current.isPending).toBe(true);
        expect(result.current.isFetching).toBe(false);
        expect(result.current.data).toBeUndefined();
    });

    test("should watch wallet status successfully", async ({
        mockFrakProviders,
    }) => {
        const mockStatus: WalletStatusReturnType = {
            key: "connected",
            wallet: "0x1234567890123456789012345678901234567890",
        };

        vi.mocked(watchWalletStatus).mockResolvedValue(mockStatus);

        const { result } = renderHook(() => useWalletStatus(), {
            wrapper: mockFrakProviders,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual(mockStatus);
        expect(watchWalletStatus).toHaveBeenCalledTimes(1);
    });

    test("should return not connected status", async ({
        mockFrakProviders,
    }) => {
        const mockStatus: WalletStatusReturnType = {
            key: "not-connected",
        };

        vi.mocked(watchWalletStatus).mockResolvedValue(mockStatus);

        const { result } = renderHook(() => useWalletStatus(), {
            wrapper: mockFrakProviders,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual(mockStatus);
        expect(result.current.data?.key).toBe("not-connected");
    });

    test("should handle RPC errors", async ({ mockFrakProviders }) => {
        const error = new Error("Wallet status watch failed");
        vi.mocked(watchWalletStatus).mockRejectedValue(error);

        const { result } = renderHook(() => useWalletStatus(), {
            wrapper: mockFrakProviders,
        });

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toEqual(error);
    });

    test("should pass callback to watchWalletStatus", async ({
        mockFrakProviders,
        mockFrakClient,
    }) => {
        const mockStatus: WalletStatusReturnType = {
            key: "connected",
            wallet: "0x1234567890123456789012345678901234567890",
        };

        vi.mocked(watchWalletStatus).mockResolvedValue(mockStatus);

        const { result } = renderHook(() => useWalletStatus(), {
            wrapper: mockFrakProviders,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(watchWalletStatus).toHaveBeenCalledWith(
            mockFrakClient,
            expect.any(Function)
        );
    });
});
