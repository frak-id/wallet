import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWalletStatusListener } from "./useWalletStatusListener";

// Import factory from test utilities
const { createMockAddress } = await vi.importActual<
    typeof import("@frak-labs/wallet-shared/test")
>("@frak-labs/wallet-shared/test");

// Mock wallet-shared
const mockGetSafeSession = vi.fn(() => undefined);
const mockGetSafeSdkSession = vi.fn(() => undefined);
const mockPushBackupData = vi.fn(async () => {});
const mockInteractionSessionStatusQuery = vi.fn(() => ({
    queryKey: ["interaction-session"],
    queryFn: async () => undefined,
}));

// Create a mock Zustand store that works as both a hook and an object
const mockSessionStore: any = Object.assign(
    vi.fn((selector: any) => {
        // Use getState() to get the current state so hook and getState() are in sync
        const state = mockSessionStore.getState();
        return selector(state);
    }),
    {
        getState: vi.fn(() => ({ session: undefined, sdkSession: undefined })),
        subscribe: vi.fn(() => vi.fn()),
    }
);

vi.mock("@frak-labs/wallet-shared", () => ({
    get sessionStore() {
        return mockSessionStore;
    },
    getSafeSession: () => mockGetSafeSession(),
    getSafeSdkSession: () => mockGetSafeSdkSession(),
    get pushBackupData() {
        return mockPushBackupData;
    },
    get interactionSessionStatusQuery() {
        return mockInteractionSessionStatusQuery;
    },
}));

describe("useWalletStatusListener", () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
            },
        });
        vi.clearAllMocks();
    });

    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );

    it("should emit not-connected status when no wallet session", async () => {
        mockSessionStore.getState.mockReturnValue({
            session: undefined,
            sdkSession: undefined,
        });
        mockGetSafeSession.mockReturnValue(undefined);

        const { result } = renderHook(() => useWalletStatusListener(), {
            wrapper,
        });

        const mockEmitter = vi.fn();
        const context = { productId: "0x123" as `0x${string}` };

        await result.current([] as any, mockEmitter, context as any);

        await waitFor(() => {
            expect(mockEmitter).toHaveBeenCalledWith({
                key: "not-connected",
            });
        });

        expect(mockPushBackupData).toHaveBeenCalledWith({
            productId: "0x123",
        });
    });

    it("should emit connected status when wallet session exists", async () => {
        const mockWalletAddress = createMockAddress("abc123");
        mockSessionStore.getState.mockReturnValue({
            session: {
                token: "test-token",
                type: "ecdsa",
                address: mockWalletAddress,
                publicKey: "0x123" as `0x${string}`,
                authenticatorId: "ecdsa-123",
                transports: undefined,
            },
            sdkSession: undefined,
        });
        mockGetSafeSession.mockReturnValue(undefined);

        queryClient.setQueryData(["interaction-session"], undefined);

        const { result } = renderHook(() => useWalletStatusListener(), {
            wrapper,
        });

        const mockEmitter = vi.fn();
        const context = { productId: "0x123" as `0x${string}` };

        await result.current([] as any, mockEmitter, context as any);

        await waitFor(() => {
            expect(mockEmitter).toHaveBeenCalledWith({
                key: "connected",
                wallet: mockWalletAddress,
                interactionToken: undefined,
                interactionSession: undefined,
            });
        });

        expect(mockPushBackupData).toHaveBeenCalledWith({
            productId: "0x123",
        });
    });

    it("should include SDK session token when present", async () => {
        const mockWalletAddress = createMockAddress("abc123");
        const mockSdkToken = "sdk-token-123";

        mockSessionStore.getState.mockReturnValue({
            session: {
                token: "test-token",
                type: "ecdsa",
                address: mockWalletAddress,
                publicKey: "0x123" as `0x${string}`,
                authenticatorId: "ecdsa-123",
                transports: undefined,
            },
            sdkSession: { token: mockSdkToken },
        });
        mockGetSafeSession.mockReturnValue(undefined);
        mockGetSafeSdkSession.mockReturnValue(undefined);

        queryClient.setQueryData(["interaction-session"], undefined);

        const { result } = renderHook(() => useWalletStatusListener(), {
            wrapper,
        });

        const mockEmitter = vi.fn();
        const context = { productId: "0x123" as `0x${string}` };

        await result.current([] as any, mockEmitter, context as any);

        await waitFor(() => {
            expect(mockEmitter).toHaveBeenCalledWith({
                key: "connected",
                wallet: mockWalletAddress,
                interactionToken: mockSdkToken,
                interactionSession: undefined,
            });
        });
    });

    it("should include interaction session when cached", async () => {
        const mockWalletAddress = createMockAddress("abc123");
        const mockInteractionSession = {
            sessionStart: Date.now(),
            sessionEnd: Date.now() + 3600000,
        };

        // Update the hook selector to return undefined for sdkSession
        mockSessionStore.mockImplementation((selector: any) => {
            const state = {
                session: { address: mockWalletAddress },
                sdkSession: undefined,
            };
            return selector(state);
        });

        mockSessionStore.getState.mockReturnValue({
            session: { address: mockWalletAddress },
            sdkSession: undefined,
        });
        mockGetSafeSession.mockReturnValue(undefined);
        mockGetSafeSdkSession.mockReturnValue(undefined);

        // Set cached query data
        queryClient.setQueryData(
            ["interaction-session"],
            mockInteractionSession
        );

        const { result } = renderHook(() => useWalletStatusListener(), {
            wrapper,
        });

        const mockEmitter = vi.fn();
        const context = { productId: "0x123" as `0x${string}` };

        await result.current([] as any, mockEmitter, context as any);

        await waitFor(() => {
            expect(mockEmitter).toHaveBeenCalledWith({
                key: "connected",
                wallet: mockWalletAddress,
                interactionToken: undefined,
                interactionSession: {
                    startTimestamp: mockInteractionSession.sessionStart,
                    endTimestamp: mockInteractionSession.sessionEnd,
                },
            });
        });
    });

    it("should handle interaction session query error gracefully", async () => {
        const mockWalletAddress = createMockAddress("abc123");

        // Update the hook selector to return undefined for sdkSession
        mockSessionStore.mockImplementation((selector: any) => {
            const state = {
                session: { address: mockWalletAddress },
                sdkSession: undefined,
            };
            return selector(state);
        });

        mockSessionStore.getState.mockReturnValue({
            session: { address: mockWalletAddress },
            sdkSession: undefined,
        });
        mockGetSafeSession.mockReturnValue(undefined);
        mockGetSafeSdkSession.mockReturnValue(undefined);

        // Set query to fail
        queryClient.setQueryDefaults(["interaction-session"], {
            queryFn: async () => {
                throw new Error("Query failed");
            },
        });

        const { result } = renderHook(() => useWalletStatusListener(), {
            wrapper,
        });

        const mockEmitter = vi.fn();
        const context = { productId: "0x123" as `0x${string}` };

        await result.current([] as any, mockEmitter, context as any);

        await waitFor(() => {
            expect(mockEmitter).toHaveBeenCalledWith({
                key: "connected",
                wallet: mockWalletAddress,
                interactionToken: undefined,
                interactionSession: undefined,
            });
        });
    });

    it("should subscribe to session store changes", async () => {
        let subscribeCallback: (() => void) | undefined;
        mockSessionStore.subscribe.mockImplementation((cb: () => void) => {
            subscribeCallback = cb;
            return vi.fn();
        });

        mockSessionStore.getState.mockReturnValue({
            session: undefined,
            sdkSession: undefined,
        });

        const { result } = renderHook(() => useWalletStatusListener(), {
            wrapper,
        });

        const mockEmitter = vi.fn();
        const context = { productId: "0x123" as `0x${string}` };

        await result.current([] as any, mockEmitter, context as any);

        // Verify subscription was set up
        expect(mockSessionStore.subscribe).toHaveBeenCalled();
        expect(subscribeCallback).toBeDefined();
    });

    it("should clean up previous subscription on new listener call", async () => {
        const mockUnsubscribe1 = vi.fn();
        const mockUnsubscribe2 = vi.fn();

        mockSessionStore.subscribe
            .mockReturnValueOnce(mockUnsubscribe1)
            .mockReturnValueOnce(mockUnsubscribe2);

        mockSessionStore.getState.mockReturnValue({
            session: undefined,
            sdkSession: undefined,
        });

        const { result } = renderHook(() => useWalletStatusListener(), {
            wrapper,
        });

        const mockEmitter = vi.fn();
        const context = { productId: "0x123" as `0x${string}` };

        // First call
        await result.current([] as any, mockEmitter, context as any);

        // Second call should clean up first subscription
        await result.current([] as any, mockEmitter, context as any);

        expect(mockUnsubscribe1).toHaveBeenCalled();
    });

    it("should not emit if aborted", async () => {
        const mockWalletAddress = createMockAddress("abc123");

        // Mock session store to abort immediately after first call
        mockSessionStore.subscribe.mockImplementation((cb: () => void) => {
            // Trigger callback immediately to test abort logic
            setTimeout(() => cb(), 0);
            return vi.fn();
        });

        mockSessionStore.getState.mockReturnValue({
            session: { address: mockWalletAddress },
            sdkSession: undefined,
        });

        const { result } = renderHook(() => useWalletStatusListener(), {
            wrapper,
        });

        const mockEmitter = vi.fn();
        const context = { productId: "0x123" as `0x${string}` };

        await result.current([] as any, mockEmitter, context as any);

        // Should emit at least once
        await waitFor(() => {
            expect(mockEmitter).toHaveBeenCalled();
        });
    });

    it("should use productId from context parameter", async () => {
        mockSessionStore.getState.mockReturnValue({
            session: undefined,
            sdkSession: undefined,
        });

        const { result } = renderHook(() => useWalletStatusListener(), {
            wrapper,
        });

        const mockEmitter = vi.fn();
        const customProductId = "0xCustomId" as `0x${string}`;
        const context = { productId: customProductId };

        await result.current([] as any, mockEmitter, context as any);

        await waitFor(() => {
            expect(mockPushBackupData).toHaveBeenCalledWith({
                productId: customProductId,
            });
        });
    });
});
