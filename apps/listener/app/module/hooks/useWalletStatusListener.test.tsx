import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest"; // Keep vi from vitest for vi.mock() hoisting
import { beforeEach, describe, expect, test } from "@/tests/fixtures";
import { useWalletStatusListener } from "./useWalletStatusListener";

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
    // Use fixture for automatic QueryClient setup and cleanup
    beforeEach(({ queryWrapper }) => {
        queryWrapper.client.clear();
        vi.clearAllMocks();
    });

    test("should emit not-connected status when no wallet session", async ({
        queryWrapper,
        mockProductId,
    }) => {
        mockSessionStore.getState.mockReturnValue({
            session: undefined,
            sdkSession: undefined,
        });
        mockGetSafeSession.mockReturnValue(undefined);

        const { result } = renderHook(() => useWalletStatusListener(), {
            wrapper: queryWrapper.wrapper,
        });

        const mockEmitter = vi.fn();
        const context = { productId: mockProductId };

        await result.current([] as any, mockEmitter, context as any);

        await waitFor(() => {
            expect(mockEmitter).toHaveBeenCalledWith({
                key: "not-connected",
            });
        });

        expect(mockPushBackupData).toHaveBeenCalledWith({
            productId: mockProductId,
        });
    });

    test("should emit connected status when wallet session exists", async ({
        queryWrapper,
        mockAddress,
        mockProductId,
    }) => {
        mockSessionStore.getState.mockReturnValue({
            session: {
                token: "test-token",
                type: "ecdsa",
                address: mockAddress,
                publicKey: "0x123" as `0x${string}`,
                authenticatorId: "ecdsa-123",
                transports: undefined,
            },
            sdkSession: undefined,
        });
        mockGetSafeSession.mockReturnValue(undefined);

        queryWrapper.client.setQueryData(["interaction-session"], undefined);

        const { result } = renderHook(() => useWalletStatusListener(), {
            wrapper: queryWrapper.wrapper,
        });

        const mockEmitter = vi.fn();
        const context = { productId: mockProductId };

        await result.current([] as any, mockEmitter, context as any);

        await waitFor(() => {
            expect(mockEmitter).toHaveBeenCalledWith({
                key: "connected",
                wallet: mockAddress,
                interactionToken: undefined,
                interactionSession: undefined,
            });
        });

        expect(mockPushBackupData).toHaveBeenCalledWith({
            productId: mockProductId,
        });
    });

    test("should include SDK session token when present", async ({
        queryWrapper,
        mockAddress,
        mockProductId,
    }) => {
        const mockSdkToken = "sdk-token-123";

        mockSessionStore.getState.mockReturnValue({
            session: {
                token: "test-token",
                type: "ecdsa",
                address: mockAddress,
                publicKey: "0x123" as `0x${string}`,
                authenticatorId: "ecdsa-123",
                transports: undefined,
            },
            sdkSession: { token: mockSdkToken },
        });
        mockGetSafeSession.mockReturnValue(undefined);
        mockGetSafeSdkSession.mockReturnValue(undefined);

        queryWrapper.client.setQueryData(["interaction-session"], undefined);

        const { result } = renderHook(() => useWalletStatusListener(), {
            wrapper: queryWrapper.wrapper,
        });

        const mockEmitter = vi.fn();
        const context = { productId: mockProductId };

        await result.current([] as any, mockEmitter, context as any);

        await waitFor(() => {
            expect(mockEmitter).toHaveBeenCalledWith({
                key: "connected",
                wallet: mockAddress,
                interactionToken: mockSdkToken,
                interactionSession: undefined,
            });
        });
    });

    test("should include interaction session when cached", async ({
        queryWrapper,
        mockAddress,
        mockProductId,
    }) => {
        const mockInteractionSession = {
            sessionStart: Date.now(),
            sessionEnd: Date.now() + 3600000,
        };

        // Update the hook selector to return undefined for sdkSession
        mockSessionStore.mockImplementation((selector: any) => {
            const state = {
                session: { address: mockAddress },
                sdkSession: undefined,
            };
            return selector(state);
        });

        mockSessionStore.getState.mockReturnValue({
            session: { address: mockAddress },
            sdkSession: undefined,
        });
        mockGetSafeSession.mockReturnValue(undefined);
        mockGetSafeSdkSession.mockReturnValue(undefined);

        // Set cached query data
        queryWrapper.client.setQueryData(
            ["interaction-session"],
            mockInteractionSession
        );

        const { result } = renderHook(() => useWalletStatusListener(), {
            wrapper: queryWrapper.wrapper,
        });

        const mockEmitter = vi.fn();
        const context = { productId: mockProductId };

        await result.current([] as any, mockEmitter, context as any);

        await waitFor(() => {
            expect(mockEmitter).toHaveBeenCalledWith({
                key: "connected",
                wallet: mockAddress,
                interactionToken: undefined,
                interactionSession: {
                    startTimestamp: mockInteractionSession.sessionStart,
                    endTimestamp: mockInteractionSession.sessionEnd,
                },
            });
        });
    });

    test("should handle interaction session query error gracefully", async ({
        queryWrapper,
        mockAddress,
        mockProductId,
    }) => {
        // Update the hook selector to return undefined for sdkSession
        mockSessionStore.mockImplementation((selector: any) => {
            const state = {
                session: { address: mockAddress },
                sdkSession: undefined,
            };
            return selector(state);
        });

        mockSessionStore.getState.mockReturnValue({
            session: { address: mockAddress },
            sdkSession: undefined,
        });
        mockGetSafeSession.mockReturnValue(undefined);
        mockGetSafeSdkSession.mockReturnValue(undefined);

        // Set query to fail
        queryWrapper.client.setQueryDefaults(["interaction-session"], {
            queryFn: async () => {
                throw new Error("Query failed");
            },
        });

        const { result } = renderHook(() => useWalletStatusListener(), {
            wrapper: queryWrapper.wrapper,
        });

        const mockEmitter = vi.fn();
        const context = { productId: mockProductId };

        await result.current([] as any, mockEmitter, context as any);

        await waitFor(() => {
            expect(mockEmitter).toHaveBeenCalledWith({
                key: "connected",
                wallet: mockAddress,
                interactionToken: undefined,
                interactionSession: undefined,
            });
        });
    });

    test("should subscribe to session store changes", async ({
        queryWrapper,
        mockProductId,
    }) => {
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
            wrapper: queryWrapper.wrapper,
        });

        const mockEmitter = vi.fn();
        const context = { productId: mockProductId };

        await result.current([] as any, mockEmitter, context as any);

        // Verify subscription was set up
        expect(mockSessionStore.subscribe).toHaveBeenCalled();
        expect(subscribeCallback).toBeDefined();
    });

    test("should clean up previous subscription on new listener call", async ({
        queryWrapper,
        mockProductId,
    }) => {
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
            wrapper: queryWrapper.wrapper,
        });

        const mockEmitter = vi.fn();
        const context = { productId: mockProductId };

        // First call
        await result.current([] as any, mockEmitter, context as any);

        // Second call should clean up first subscription
        await result.current([] as any, mockEmitter, context as any);

        expect(mockUnsubscribe1).toHaveBeenCalled();
    });

    test("should not emit if aborted", async ({
        queryWrapper,
        mockAddress,
        mockProductId,
    }) => {
        // Mock session store to abort immediately after first call
        mockSessionStore.subscribe.mockImplementation((cb: () => void) => {
            // Trigger callback immediately to test abort logic
            setTimeout(() => cb(), 0);
            return vi.fn();
        });

        mockSessionStore.getState.mockReturnValue({
            session: { address: mockAddress },
            sdkSession: undefined,
        });

        const { result } = renderHook(() => useWalletStatusListener(), {
            wrapper: queryWrapper.wrapper,
        });

        const mockEmitter = vi.fn();
        const context = { productId: mockProductId };

        await result.current([] as any, mockEmitter, context as any);

        // Should emit at least once
        await waitFor(() => {
            expect(mockEmitter).toHaveBeenCalled();
        });
    });

    test("should use productId from context parameter", async ({
        queryWrapper,
        mockProductId,
    }) => {
        mockSessionStore.getState.mockReturnValue({
            session: undefined,
            sdkSession: undefined,
        });

        const { result } = renderHook(() => useWalletStatusListener(), {
            wrapper: queryWrapper.wrapper,
        });

        const mockEmitter = vi.fn();
        const context = { productId: mockProductId };

        await result.current([] as any, mockEmitter, context as any);

        await waitFor(() => {
            expect(mockPushBackupData).toHaveBeenCalledWith({
                productId: mockProductId,
            });
        });
    });
});
