import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type React from "react";
import type { ReactNode } from "react";
import type { Hex } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockAddress } from "../../test/factories";
import { usePushInteraction } from "./usePushInteraction";

vi.mock("../../common/analytics", () => ({
    trackGenericEvent: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../common/api/backendClient", () => ({
    authenticatedWalletApi: {
        interactions: {
            push: {
                post: vi.fn(),
            },
        },
    },
}));

vi.mock("../../common/hook/useGetSafeSdkSession", () => ({
    useGetSafeSdkSession: vi.fn(),
}));

vi.mock("../../sdk/utils/backup", () => ({
    pushBackupData: vi.fn(),
}));

vi.mock("../../stores/sessionStore", () => ({
    sessionStore: vi.fn(),
    selectSession: vi.fn((state: any) => state?.session),
}));

vi.mock("../../stores/walletStore", () => ({
    walletStore: {
        getState: vi.fn(() => ({
            addPendingInteraction: vi.fn(),
        })),
    },
}));

describe("usePushInteraction", () => {
    let queryClient: QueryClient;
    let wrapper: ({ children }: { children: ReactNode }) => React.ReactElement;
    const mockAddress = createMockAddress();
    const mockProductId =
        "0x0000000000000000000000000000000000000000000000000000000000000001" as Hex;
    const mockInteraction = {
        handlerTypeDenominator: "0x01" as Hex,
        interactionData: "0xdata" as Hex,
    };
    const mockDelegationId =
        "0xdelegation1234567890123456789012345678901234567890" as Hex;

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

    it("should return pending-wallet status when no user address", async () => {
        const { useGetSafeSdkSession } = await import(
            "../../common/hook/useGetSafeSdkSession"
        );
        const { pushBackupData } = await import("../../sdk/utils/backup");
        const { sessionStore } = await import("../../stores/sessionStore");
        const { walletStore } = await import("../../stores/walletStore");

        const addPendingInteraction = vi.fn();
        vi.mocked(walletStore.getState).mockReturnValue({
            addPendingInteraction,
        } as any);
        vi.mocked(sessionStore).mockReturnValue(undefined);
        vi.mocked(useGetSafeSdkSession).mockReturnValue({
            sdkSession: null,
            getSdkSession: vi.fn(),
        } as any);
        vi.mocked(pushBackupData).mockResolvedValue(undefined);

        const { result } = renderHook(() => usePushInteraction(), { wrapper });

        let pushResult: any;
        await act(async () => {
            pushResult = await result.current({
                productId: mockProductId,
                interaction: mockInteraction,
            });
        });

        expect(pushResult).toEqual({ status: "pending-wallet" });
        expect(addPendingInteraction).toHaveBeenCalledWith({
            productId: mockProductId,
            interaction: mockInteraction,
            signature: undefined,
            timestamp: expect.any(Number),
        });
        expect(pushBackupData).toHaveBeenCalledWith({
            productId: mockProductId,
        });
    });

    it("should return no-sdk-session status when session unavailable", async () => {
        const { useGetSafeSdkSession } = await import(
            "../../common/hook/useGetSafeSdkSession"
        );
        const { sessionStore } = await import("../../stores/sessionStore");

        vi.mocked(sessionStore).mockReturnValue({ address: mockAddress });
        vi.mocked(useGetSafeSdkSession).mockReturnValue({
            sdkSession: null,
            getSdkSession: vi.fn().mockResolvedValue({ data: null }),
        } as any);

        const { result } = renderHook(() => usePushInteraction(), { wrapper });

        let pushResult: any;
        await act(async () => {
            pushResult = await result.current({
                productId: mockProductId,
                interaction: mockInteraction,
            });
        });

        expect(pushResult).toEqual({ status: "no-sdk-session" });
    });

    it("should push interaction successfully", async () => {
        const { useGetSafeSdkSession } = await import(
            "../../common/hook/useGetSafeSdkSession"
        );
        const { authenticatedWalletApi } = await import(
            "../../common/api/backendClient"
        );
        const { trackGenericEvent } = await import("../../common/analytics");
        const { sessionStore } = await import("../../stores/sessionStore");

        vi.mocked(sessionStore).mockReturnValue({ address: mockAddress });
        vi.mocked(useGetSafeSdkSession).mockReturnValue({
            sdkSession: { token: "session-token" },
            getSdkSession: vi.fn(),
        } as any);
        vi.mocked(
            authenticatedWalletApi.interactions.push.post
        ).mockResolvedValue({
            data: [mockDelegationId],
            error: null,
        } as any);

        const { result } = renderHook(() => usePushInteraction(), { wrapper });

        let pushResult: any;
        await act(async () => {
            pushResult = await result.current({
                productId: mockProductId,
                interaction: mockInteraction,
            });
        });

        expect(pushResult).toEqual({
            status: "success",
            delegationId: mockDelegationId,
        });
        expect(
            authenticatedWalletApi.interactions.push.post
        ).toHaveBeenCalledWith({
            interactions: [
                {
                    wallet: mockAddress,
                    productId: mockProductId,
                    interaction: mockInteraction,
                    signature: undefined,
                },
            ],
        });
        expect(trackGenericEvent).toHaveBeenCalledWith("interaction-pushed", {
            productId: mockProductId,
            handlerType: mockInteraction.handlerTypeDenominator,
            data: mockInteraction.interactionData,
        });
    });

    it("should fetch SDK session if not available", async () => {
        const { useGetSafeSdkSession } = await import(
            "../../common/hook/useGetSafeSdkSession"
        );
        const { authenticatedWalletApi } = await import(
            "../../common/api/backendClient"
        );
        const { sessionStore } = await import("../../stores/sessionStore");

        const getSdkSession = vi
            .fn()
            .mockResolvedValue({ data: { token: "fetched-token" } });
        vi.mocked(sessionStore).mockReturnValue({ address: mockAddress });
        vi.mocked(useGetSafeSdkSession).mockReturnValue({
            sdkSession: null,
            getSdkSession,
        } as any);
        vi.mocked(
            authenticatedWalletApi.interactions.push.post
        ).mockResolvedValue({
            data: [mockDelegationId],
            error: null,
        } as any);

        const { result } = renderHook(() => usePushInteraction(), { wrapper });

        await act(async () => {
            await result.current({
                productId: mockProductId,
                interaction: mockInteraction,
            });
        });

        expect(getSdkSession).toHaveBeenCalled();
    });

    it("should return push-error status on API error", async () => {
        const { useGetSafeSdkSession } = await import(
            "../../common/hook/useGetSafeSdkSession"
        );
        const { authenticatedWalletApi } = await import(
            "../../common/api/backendClient"
        );
        const { sessionStore } = await import("../../stores/sessionStore");

        vi.mocked(sessionStore).mockReturnValue({ address: mockAddress });
        vi.mocked(useGetSafeSdkSession).mockReturnValue({
            sdkSession: { token: "session-token" },
            getSdkSession: vi.fn(),
        } as any);
        vi.mocked(
            authenticatedWalletApi.interactions.push.post
        ).mockResolvedValue({
            data: null,
            error: { message: "API Error" },
        } as any);

        const consoleSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => {});

        const { result } = renderHook(() => usePushInteraction(), { wrapper });

        let pushResult: any;
        await act(async () => {
            pushResult = await result.current({
                productId: mockProductId,
                interaction: mockInteraction,
            });
        });

        expect(pushResult).toEqual({ status: "push-error" });
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    it("should return push-error status on exception", async () => {
        const { useGetSafeSdkSession } = await import(
            "../../common/hook/useGetSafeSdkSession"
        );
        const { authenticatedWalletApi } = await import(
            "../../common/api/backendClient"
        );
        const { sessionStore } = await import("../../stores/sessionStore");

        vi.mocked(sessionStore).mockReturnValue({ address: mockAddress });
        vi.mocked(useGetSafeSdkSession).mockReturnValue({
            sdkSession: { token: "session-token" },
            getSdkSession: vi.fn(),
        } as any);
        vi.mocked(
            authenticatedWalletApi.interactions.push.post
        ).mockRejectedValue(new Error("Network error"));

        const consoleSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => {});

        const { result } = renderHook(() => usePushInteraction(), { wrapper });

        let pushResult: any;
        await act(async () => {
            pushResult = await result.current({
                productId: mockProductId,
                interaction: mockInteraction,
            });
        });

        expect(pushResult).toEqual({ status: "push-error" });
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    it("should include signature when provided", async () => {
        const { useGetSafeSdkSession } = await import(
            "../../common/hook/useGetSafeSdkSession"
        );
        const { authenticatedWalletApi } = await import(
            "../../common/api/backendClient"
        );
        const { sessionStore } = await import("../../stores/sessionStore");

        const mockSignature = "0xsig123" as Hex;
        vi.mocked(sessionStore).mockReturnValue({ address: mockAddress });
        vi.mocked(useGetSafeSdkSession).mockReturnValue({
            sdkSession: { token: "session-token" },
            getSdkSession: vi.fn(),
        } as any);
        vi.mocked(
            authenticatedWalletApi.interactions.push.post
        ).mockResolvedValue({
            data: [mockDelegationId],
            error: null,
        } as any);

        const { result } = renderHook(() => usePushInteraction(), { wrapper });

        await act(async () => {
            await result.current({
                productId: mockProductId,
                interaction: mockInteraction,
                signature: mockSignature,
            });
        });

        expect(
            authenticatedWalletApi.interactions.push.post
        ).toHaveBeenCalledWith({
            interactions: [
                {
                    wallet: mockAddress,
                    productId: mockProductId,
                    interaction: mockInteraction,
                    signature: mockSignature,
                },
            ],
        });
    });
});
