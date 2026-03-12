import type {
    NotificationPermissionStatus,
    PushTokenPayload,
} from "@frak-labs/wallet-shared";
import { act, renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { useUnsubscribeFromPushNotification } from "@/module/notification/hook/useUnsubscribeFromPushNotification";
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
    initPromise: Promise.resolve(),
}));

vi.mock("@frak-labs/wallet-shared", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("@frak-labs/wallet-shared")>();
    return {
        ...actual,
        notificationAdapter: mockAdapter,
        authenticatedWalletApi: {
            notifications: { tokens: mockTokensApi },
        },
    };
});

describe.sequential("useUnsubscribeFromPushNotification", () => {
    beforeEach(({ queryWrapper }: WalletTestFixtures) => {
        queryWrapper.client.clear();

        mockAdapter.unsubscribe.mockReset().mockResolvedValue(undefined);

        mockTokensApi.delete.mockReset().mockResolvedValue(undefined);
    });

    test("should return mutation functions and idle state initially", ({
        queryWrapper,
    }: WalletTestFixtures) => {
        const { result } = renderHook(
            () => useUnsubscribeFromPushNotification(),
            { wrapper: queryWrapper.wrapper }
        );

        expect(result.current.unsubscribeFromPush).toBeTypeOf("function");
        expect(result.current.unsubscribeFromPushAsync).toBeTypeOf("function");
        expect(result.current.isPending).toBe(false);
        expect(result.current.isSuccess).toBe(false);
    });

    test("should call adapter.unsubscribe and API delete on mutation", async ({
        queryWrapper,
    }: WalletTestFixtures) => {
        const { result } = renderHook(
            () => useUnsubscribeFromPushNotification(),
            { wrapper: queryWrapper.wrapper }
        );

        await act(async () => {
            await result.current.unsubscribeFromPushAsync();
        });

        expect(mockAdapter.unsubscribe).toHaveBeenCalledOnce();
        expect(mockTokensApi.delete).toHaveBeenCalledOnce();
    });

    test("should update query cache on successful unsubscribe", async ({
        queryWrapper,
    }: WalletTestFixtures) => {
        const { notificationKey } = await import(
            "@/module/notification/queryKeys/notification"
        );

        const { result } = renderHook(
            () => useUnsubscribeFromPushNotification(),
            { wrapper: queryWrapper.wrapper }
        );

        await act(async () => {
            await result.current.unsubscribeFromPushAsync();
        });

        expect(mockAdapter.unsubscribe).toHaveBeenCalledOnce();
        expect(mockTokensApi.delete).toHaveBeenCalledOnce();

        await waitFor(() => {
            expect(
                queryWrapper.client.getQueryData(
                    notificationKey.push.permission
                )
            ).toBe("prompt");
            expect(
                queryWrapper.client.getQueryData(
                    notificationKey.push.backendToken
                )
            ).toBe(false);
        });
    });

    test("should report error state when adapter.unsubscribe fails", async ({
        queryWrapper,
    }: WalletTestFixtures) => {
        mockAdapter.unsubscribe.mockRejectedValue(
            new Error("unsubscribe failed")
        );

        const { result } = renderHook(
            () => useUnsubscribeFromPushNotification(),
            { wrapper: queryWrapper.wrapper }
        );

        await act(async () => {
            try {
                await result.current.unsubscribeFromPushAsync();
            } catch {
                // Expected rejection
            }
        });

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });
    });
});
