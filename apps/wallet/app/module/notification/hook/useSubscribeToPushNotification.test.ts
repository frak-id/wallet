import { act, renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import type {
    NotificationPermissionStatus,
    PushTokenPayload,
} from "@/module/notification/adapter";
import { useSubscribeToPushNotification } from "@/module/notification/hook/useSubscribeToPushNotification";
import { notificationOptOutStore } from "@/module/notification/stores/notificationOptOutStore";
import {
    beforeEach,
    describe,
    expect,
    test,
    type WalletTestFixtures,
} from "@/tests/vitest-fixtures";

const mockTokensApi = vi.hoisted(() => ({
    hasAny: { get: vi.fn().mockResolvedValue({ data: false }) },
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
}));

const mockAdapter = vi.hoisted(() => ({
    getPermissionStatus: vi
        .fn()
        .mockResolvedValue("granted" satisfies NotificationPermissionStatus),
    requestPermission: vi
        .fn()
        .mockResolvedValue("granted" satisfies NotificationPermissionStatus),
    getToken: vi.fn().mockResolvedValue(null as PushTokenPayload | null),
    subscribe: vi.fn().mockResolvedValue(undefined),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
    openSettings: vi.fn().mockResolvedValue(undefined),
    events: new EventTarget(),
    initPromise: Promise.resolve(),
}));

vi.mock("@/module/notification/adapter", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("@/module/notification/adapter")>();
    return {
        ...actual,
        notificationAdapter: mockAdapter,
    };
});

vi.mock("@frak-labs/wallet-shared", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("@frak-labs/wallet-shared")>();
    return {
        ...actual,
        authenticatedWalletApi: {
            notifications: { tokens: mockTokensApi },
        },
    };
});

const validTokenPayload: PushTokenPayload = {
    type: "fcm",
    token: "subscribe-token",
};

describe.sequential("useSubscribeToPushNotification", () => {
    beforeEach(({ queryWrapper }: WalletTestFixtures) => {
        queryWrapper.client.clear();

        mockAdapter.subscribe.mockReset().mockResolvedValue(validTokenPayload);
        mockTokensApi.put.mockReset().mockResolvedValue(undefined);

        // Start each test with the opt-out flag set so we can assert it
        // gets cleared on a successful subscribe.
        notificationOptOutStore.getState().setOptedOut(true);
    });

    test("should clear opt-out flag on successful subscribe", async ({
        queryWrapper,
    }: WalletTestFixtures) => {
        const { result } = renderHook(() => useSubscribeToPushNotification(), {
            wrapper: queryWrapper.wrapper,
        });

        await act(async () => {
            await result.current.subscribeToPushAsync();
        });

        expect(mockAdapter.subscribe).toHaveBeenCalledOnce();
        expect(mockTokensApi.put).toHaveBeenCalledOnce();
        expect(notificationOptOutStore.getState().optedOut).toBe(false);
    });

    test("should leave opt-out flag set when adapter.subscribe throws", async ({
        queryWrapper,
    }: WalletTestFixtures) => {
        mockAdapter.subscribe.mockRejectedValue(new Error("subscribe failed"));

        const { result } = renderHook(() => useSubscribeToPushNotification(), {
            wrapper: queryWrapper.wrapper,
        });

        await act(async () => {
            try {
                await result.current.subscribeToPushAsync();
            } catch {
                // Expected rejection
            }
        });

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(mockTokensApi.put).not.toHaveBeenCalled();
        expect(notificationOptOutStore.getState().optedOut).toBe(true);
    });

    test("should clear opt-out flag even when backend put() throws after subscribe success", async ({
        queryWrapper,
    }: WalletTestFixtures) => {
        // Subscribe succeeds (OS-level state now matches "subscribed"),
        // but the backend put rejects. The flag should already be cleared
        // by the time put() runs so reconciliation can recover.
        mockTokensApi.put.mockRejectedValue(new Error("backend down"));

        const { result } = renderHook(() => useSubscribeToPushNotification(), {
            wrapper: queryWrapper.wrapper,
        });

        await act(async () => {
            try {
                await result.current.subscribeToPushAsync();
            } catch {
                // Expected rejection
            }
        });

        expect(mockAdapter.subscribe).toHaveBeenCalledOnce();
        expect(notificationOptOutStore.getState().optedOut).toBe(false);
    });
});
