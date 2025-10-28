/** @jsxImportSource react */

import * as walletShared from "@frak-labs/wallet-shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePreviousAuthenticators } from "@/module/authentication/hook/usePreviousAuthenticators";

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
    let queryClient: QueryClient;

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        });
        vi.clearAllMocks();
    });

    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );

    it("should return loading state initially", () => {
        vi.spyOn(walletShared.authenticatorStorage, "getAll").mockResolvedValue(
            []
        );

        const { result } = renderHook(() => usePreviousAuthenticators(), {
            wrapper,
        });

        expect(result.current.isLoading).toBe(true);
        expect(result.current.data).toBeUndefined();
    });

    it("should successfully fetch authenticators from storage", async () => {
        const mockAuthenticators = [
            {
                wallet: "0x1234567890123456789012345678901234567890" as `0x${string}`,
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
            wrapper,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual(mockAuthenticators);
        expect(walletShared.authenticatorStorage.getAll).toHaveBeenCalledTimes(
            1
        );
    });

    it("should return empty array when no authenticators exist", async () => {
        vi.spyOn(walletShared.authenticatorStorage, "getAll").mockResolvedValue(
            []
        );

        const { result } = renderHook(() => usePreviousAuthenticators(), {
            wrapper,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual([]);
    });

    it("should handle storage errors gracefully", async () => {
        const mockError = new Error("Storage error");
        vi.spyOn(walletShared.authenticatorStorage, "getAll").mockRejectedValue(
            mockError
        );

        const { result } = renderHook(() => usePreviousAuthenticators(), {
            wrapper,
        });

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBe(mockError);
    });

    it("should be enabled by default", () => {
        vi.spyOn(walletShared.authenticatorStorage, "getAll").mockResolvedValue(
            []
        );

        const { result } = renderHook(() => usePreviousAuthenticators(), {
            wrapper,
        });

        // The query should execute immediately since enabled is true
        expect(result.current.isLoading).toBe(true);
    });
});
