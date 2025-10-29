/** @jsxImportSource react */
import * as walletShared from "@frak-labs/wallet-shared";
import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { usePreviousAuthenticators } from "@/module/authentication/hook/usePreviousAuthenticators";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

// Mock authenticatorStorage
vi.mock("@frak-labs/wallet-shared", async () => {
    const actual = await vi.importActual("@frak-labs/wallet-shared");
    return {
        ...actual,
        authenticatorStorage: {
            getAll: vi.fn(),
        },
    };
});

describe("usePreviousAuthenticators", () => {
    beforeEach(({ queryWrapper }) => {
        vi.clearAllMocks();
        queryWrapper.client.clear();
    });

    test("should return loading state initially", ({ queryWrapper }) => {
        vi.spyOn(walletShared.authenticatorStorage, "getAll").mockResolvedValue(
            []
        );

        const { result } = renderHook(() => usePreviousAuthenticators(), {
            wrapper: queryWrapper.wrapper,
        });

        expect(result.current.isLoading).toBe(true);
        expect(result.current.data).toBeUndefined();
    });

    test("should successfully fetch authenticators from storage", async ({
        queryWrapper,
        mockAddress,
    }) => {
        const mockAuthenticators = [
            {
                wallet: mockAddress,
                authenticatorId: "auth-1",
            },
            {
                wallet: "0x9876543210987654321098765432109876543210" as `0x${string}`,
                authenticatorId: "auth-2",
            },
        ];

        vi.spyOn(walletShared.authenticatorStorage, "getAll").mockResolvedValue(
            mockAuthenticators
        );

        const { result } = renderHook(() => usePreviousAuthenticators(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual(mockAuthenticators);
        expect(walletShared.authenticatorStorage.getAll).toHaveBeenCalledTimes(
            1
        );
    });

    test("should return empty array when no authenticators exist", async ({
        queryWrapper,
    }) => {
        vi.spyOn(walletShared.authenticatorStorage, "getAll").mockResolvedValue(
            []
        );

        const { result } = renderHook(() => usePreviousAuthenticators(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual([]);
    });

    test("should handle storage errors gracefully", async ({
        queryWrapper,
    }) => {
        const mockError = new Error("Storage error");
        vi.spyOn(walletShared.authenticatorStorage, "getAll").mockRejectedValue(
            mockError
        );

        const { result } = renderHook(() => usePreviousAuthenticators(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBe(mockError);
    });

    test("should be enabled by default", ({ queryWrapper }) => {
        vi.spyOn(walletShared.authenticatorStorage, "getAll").mockResolvedValue(
            []
        );

        const { result } = renderHook(() => usePreviousAuthenticators(), {
            wrapper: queryWrapper.wrapper,
        });

        expect(result.current.isLoading).toBe(true);
    });
});
