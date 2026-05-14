import { act, renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import type {
    NotificationPermissionStatus,
    PushTokenPayload,
} from "@/module/notification/adapter";
import { useSubscribeToPushNotification } from "@/module/notification/hook/useSubscribeToPushNotification";
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
    });

    test("should call adapter.subscribe and backend put on successful mutation", async ({
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
    });

    test("should not call backend put when adapter.subscribe throws", async ({
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
    });

    test("should still report error when backend put() throws after subscribe success", async ({
        queryWrapper,
    }: WalletTestFixtures) => {
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
        expect(mockTokensApi.put).toHaveBeenCalledOnce();
    });
});
