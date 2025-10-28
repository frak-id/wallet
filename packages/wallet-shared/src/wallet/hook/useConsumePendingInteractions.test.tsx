import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import type React from "react";
import type { ReactNode } from "react";
import type { Address } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockAddress } from "../../test/factories";
import { server } from "../../test/msw/server";
import { useConsumePendingInteractions } from "./useConsumePendingInteractions";

vi.mock("wagmi", () => ({
    useAccount: vi.fn(),
}));

vi.mock("../../common/hook/useGetSafeSdkSession", () => ({
    useGetSafeSdkSession: vi.fn(),
}));

vi.mock("../../sdk/utils/backup", () => ({
    pushBackupData: vi.fn(),
}));

vi.mock("../../stores/walletStore", async () => {
    const actual = await vi.importActual<
        typeof import("../../stores/walletStore")
    >("../../stores/walletStore");
    return {
        ...actual,
        walletStore: vi.fn(),
    };
});

describe("useConsumePendingInteractions", () => {
    let queryClient: QueryClient;
    let wrapper: ({ children }: { children: ReactNode }) => React.ReactElement;
    const mockAddress = createMockAddress();

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false },
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

    it("should not submit when no address is provided", async () => {
        const { useAccount } = await import("wagmi");
        const { useGetSafeSdkSession } = await import(
            "../../common/hook/useGetSafeSdkSession"
        );
        const { walletStore } = await import("../../stores/walletStore");

        vi.mocked(useAccount).mockReturnValue({ address: undefined } as any);
        vi.mocked(useGetSafeSdkSession).mockReturnValue({
            sdkSession: { token: "token", expires: Date.now() + 3600000 },
            getSdkSession: vi.fn(),
        } as any);
        vi.mocked(walletStore).mockReturnValue([
            {
                productId: "0x1234" as Address,
                interaction: {} as any,
                timestamp: Date.now(),
            },
        ]);

        const { result } = renderHook(() => useConsumePendingInteractions(), {
            wrapper,
        });

        await result.current.mutateAsync();

        expect(result.current.data).toBeUndefined();
    });

    it("should not submit when no pending interactions", async () => {
        const { useAccount } = await import("wagmi");
        const { useGetSafeSdkSession } = await import(
            "../../common/hook/useGetSafeSdkSession"
        );
        const { walletStore } = await import("../../stores/walletStore");

        vi.mocked(useAccount).mockReturnValue({
            address: mockAddress,
        } as any);
        vi.mocked(useGetSafeSdkSession).mockReturnValue({
            sdkSession: { token: "token", expires: Date.now() + 3600000 },
            getSdkSession: vi.fn(),
        } as any);
        vi.mocked(walletStore).mockReturnValue([]);

        const { result } = renderHook(() => useConsumePendingInteractions(), {
            wrapper,
        });

        await result.current.mutateAsync();

        expect(result.current.data).toBeUndefined();
    });

    it("should not submit when no SDK session", async () => {
        const { useAccount } = await import("wagmi");
        const { useGetSafeSdkSession } = await import(
            "../../common/hook/useGetSafeSdkSession"
        );
        const { walletStore } = await import("../../stores/walletStore");

        vi.mocked(useAccount).mockReturnValue({
            address: mockAddress,
        } as any);
        vi.mocked(useGetSafeSdkSession).mockReturnValue({
            sdkSession: null,
            getSdkSession: vi.fn().mockResolvedValue({ data: null }),
        } as any);
        vi.mocked(walletStore).mockReturnValue([
            {
                productId: "0x1234" as Address,
                interaction: {} as any,
                timestamp: Date.now(),
            },
        ]);

        const { result } = renderHook(() => useConsumePendingInteractions(), {
            wrapper,
        });

        await result.current.mutateAsync();

        expect(result.current.data).toBeUndefined();
    });

    it("should submit pending interactions successfully", async () => {
        const { useAccount } = await import("wagmi");
        const { useGetSafeSdkSession } = await import(
            "../../common/hook/useGetSafeSdkSession"
        );
        const { walletStore } = await import("../../stores/walletStore");
        const { pushBackupData } = await import("../../sdk/utils/backup");

        const cleanPendingInteractions = vi.fn();
        const mockInteractions = [
            {
                productId: "0x1234" as Address,
                interaction: {
                    handlerTypeDenominator: 1,
                    interactionData: "0x",
                },
                signature: "0xsig1" as Address,
                timestamp: Date.now(),
            },
            {
                productId: "0x5678" as Address,
                interaction: {
                    handlerTypeDenominator: 2,
                    interactionData: "0x",
                },
                signature: "0xsig2" as Address,
                timestamp: Date.now(),
            },
        ];

        vi.mocked(useAccount).mockReturnValue({
            address: mockAddress,
        } as any);
        vi.mocked(useGetSafeSdkSession).mockReturnValue({
            sdkSession: { token: "token", expires: Date.now() + 3600000 },
            getSdkSession: vi.fn(),
        } as any);
        vi.mocked(walletStore).mockReturnValue(mockInteractions);
        vi.mocked(walletStore).getState = vi.fn().mockReturnValue({
            cleanPendingInteractions,
        });

        const { result } = renderHook(() => useConsumePendingInteractions(), {
            wrapper,
        });

        await result.current.mutateAsync();

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual({
            delegationId: ["delegation-id-0", "delegation-id-1"],
            submittedInteractions: 2,
        });
        expect(cleanPendingInteractions).toHaveBeenCalledTimes(1);
        expect(pushBackupData).toHaveBeenCalledTimes(1);
    });

    it("should use getSdkSession when sdkSession is null", async () => {
        const { useAccount } = await import("wagmi");
        const { useGetSafeSdkSession } = await import(
            "../../common/hook/useGetSafeSdkSession"
        );
        const { walletStore } = await import("../../stores/walletStore");

        const getSdkSession = vi.fn().mockResolvedValue({
            data: { token: "new-token", expires: Date.now() + 3600000 },
        });
        const cleanPendingInteractions = vi.fn();

        vi.mocked(useAccount).mockReturnValue({
            address: mockAddress,
        } as any);
        vi.mocked(useGetSafeSdkSession).mockReturnValue({
            sdkSession: null,
            getSdkSession,
        } as any);
        vi.mocked(walletStore).mockReturnValue([
            {
                productId: "0x1234" as Address,
                interaction: {
                    handlerTypeDenominator: 1,
                    interactionData: "0x",
                },
                timestamp: Date.now(),
            },
        ]);
        vi.mocked(walletStore).getState = vi.fn().mockReturnValue({
            cleanPendingInteractions,
        });

        const { result } = renderHook(() => useConsumePendingInteractions(), {
            wrapper,
        });

        await result.current.mutateAsync();

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(getSdkSession).toHaveBeenCalledTimes(1);
        expect(cleanPendingInteractions).toHaveBeenCalledTimes(1);
    });

    it("should handle empty API response", async () => {
        const { useAccount } = await import("wagmi");
        const { useGetSafeSdkSession } = await import(
            "../../common/hook/useGetSafeSdkSession"
        );
        const { walletStore } = await import("../../stores/walletStore");
        const { pushBackupData } = await import("../../sdk/utils/backup");

        const cleanPendingInteractions = vi.fn();

        server.use(
            http.post(
                `${process.env.BACKEND_URL || "http://localhost:3030"}/wallet/interactions/push`,
                () => {
                    return HttpResponse.json([]);
                }
            )
        );

        vi.mocked(useAccount).mockReturnValue({
            address: mockAddress,
        } as any);
        vi.mocked(useGetSafeSdkSession).mockReturnValue({
            sdkSession: { token: "token", expires: Date.now() + 3600000 },
            getSdkSession: vi.fn(),
        } as any);
        vi.mocked(walletStore).mockReturnValue([
            {
                productId: "0x1234" as Address,
                interaction: {
                    handlerTypeDenominator: 1,
                    interactionData: "0x",
                },
                timestamp: Date.now(),
            },
        ]);
        vi.mocked(walletStore).getState = vi.fn().mockReturnValue({
            cleanPendingInteractions,
        });

        const { result } = renderHook(() => useConsumePendingInteractions(), {
            wrapper,
        });

        await result.current.mutateAsync();

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual({
            delegationId: [],
            submittedInteractions: 1,
        });
        expect(cleanPendingInteractions).toHaveBeenCalledTimes(1);
        expect(pushBackupData).toHaveBeenCalledTimes(1);
    });
});
