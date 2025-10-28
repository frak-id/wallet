import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type React from "react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authenticatedWalletApi } from "../../common/api/backendClient";
import { usePairingInfo } from "./usePairingInfo";

vi.mock("../../common/api/backendClient", () => ({
    authenticatedWalletApi: {
        pairings: {
            find: vi.fn().mockReturnValue({
                get: vi.fn(),
            }),
        },
    },
}));

describe("usePairingInfo", () => {
    let queryClient: QueryClient;
    let wrapper: ({ children }: { children: ReactNode }) => React.ReactElement;

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
            },
        });
        wrapper = ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        );
    });

    afterEach(() => {
        vi.clearAllMocks();
        queryClient.clear();
    });

    it("should not fetch when no id is provided", () => {
        const { result } = renderHook(() => usePairingInfo({ id: undefined }), {
            wrapper,
        });

        expect(result.current.data).toBeUndefined();
        expect(result.current.isLoading).toBe(false);
    });

    it("should fetch pairing info when id is provided", async () => {
        const mockPairingData = {
            id: "pairing-1",
            name: "Device pairing-1",
            createdAt: Date.now(),
            publicKey: "0x1234567890abcdef",
        };

        vi.mocked(authenticatedWalletApi.pairings.find).mockReturnValue({
            get: vi.fn().mockResolvedValue({
                data: mockPairingData,
                error: null,
            }),
        } as any);

        const { result } = renderHook(
            () => usePairingInfo({ id: "pairing-1" }),
            {
                wrapper,
            }
        );

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual(mockPairingData);
    });

    it("should throw error when data is null", async () => {
        vi.mocked(authenticatedWalletApi.pairings.find).mockReturnValue({
            get: vi.fn().mockResolvedValue({
                data: null,
                error: null,
            }),
        } as any);

        const { result } = renderHook(() => usePairingInfo({ id: "test-id" }), {
            wrapper,
        });

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.error?.message).toBe(
            "Failed to fetch pairing info"
        );
    });

    it("should refetch pairing info when refetch is called", async () => {
        const mockData1 = {
            id: "test-id",
            pairingCode: "code1",
            originName: "Device 1",
            createdAt: new Date(),
        };

        const mockData2 = {
            id: "test-id",
            pairingCode: "code2",
            originName: "Device 2",
            createdAt: new Date(),
        };

        const mockGet = vi
            .fn()
            .mockResolvedValueOnce({
                data: mockData1,
                error: null,
            })
            .mockResolvedValueOnce({
                data: mockData2,
                error: null,
            });

        vi.mocked(authenticatedWalletApi.pairings.find).mockReturnValue({
            get: mockGet,
        } as any);

        const { result } = renderHook(() => usePairingInfo({ id: "test-id" }), {
            wrapper,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data?.originName).toBe("Device 1");

        await result.current.refetch();

        await waitFor(() => {
            expect(result.current.data?.originName).toBe("Device 2");
        });

        expect(mockGet).toHaveBeenCalledTimes(2);
    });

    it("should be disabled when id is not provided", async () => {
        const mockGet = vi.fn();

        vi.mocked(authenticatedWalletApi.pairings.find).mockReturnValue({
            get: mockGet,
        } as any);

        const { result, rerender } = renderHook(
            ({ id }: { id?: string }) => usePairingInfo({ id }),
            {
                wrapper,
                initialProps: { id: undefined },
            }
        );

        expect(result.current.isLoading).toBe(false);
        expect(result.current.fetchStatus).toBe("idle");
        expect(mockGet).not.toHaveBeenCalled();

        // @ts-expect-error - TypeScript incorrectly infers rerender props type
        rerender({ id: "pairing-1" });

        await waitFor(() => {
            expect(mockGet).toHaveBeenCalled();
        });
    });
});
