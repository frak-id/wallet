import type {
    NotificationPermissionStatus,
    PushTokenPayload,
} from "@frak-labs/wallet-shared";
import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { useNotificationStatus } from "@/module/notification/hook/useNotificationSetupStatus";
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
        .mockResolvedValue("prompt" satisfies NotificationPermissionStatus),
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

describe.sequential("useNotificationStatus", () => {
    beforeEach(({ queryWrapper }: WalletTestFixtures) => {
        queryWrapper.client.clear();
        mockAdapter.events = new EventTarget();

        mockAdapter.getPermissionStatus
            .mockReset()
            .mockResolvedValue("prompt" satisfies NotificationPermissionStatus);
        mockAdapter.getToken.mockReset().mockResolvedValue(null);
        mockAdapter.subscribe.mockReset();
        mockAdapter.unsubscribe.mockReset().mockResolvedValue(undefined);
        mockAdapter.initPromise = Promise.resolve();

        mockTokensApi.hasAny.get.mockReset().mockResolvedValue({ data: false });
        mockTokensApi.put.mockReset().mockResolvedValue(undefined);
        mockTokensApi.delete.mockReset().mockResolvedValue(undefined);
    });

    test("should return permissionGranted when permission is granted", async ({
        queryWrapper,
    }: WalletTestFixtures) => {
        mockAdapter.getPermissionStatus.mockResolvedValue(
            "granted" satisfies NotificationPermissionStatus
        );

        const { result } = renderHook(() => useNotificationStatus(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current).toEqual({
                permissionStatus: "granted",
                permissionGranted: true,
                hasLocalCapability: false,
                hasBackendToken: false,
            });
        });
    });

    test("should report hasLocalCapability when getToken returns a token", async ({
        queryWrapper,
    }: WalletTestFixtures) => {
        mockAdapter.getPermissionStatus.mockResolvedValue(
            "granted" satisfies NotificationPermissionStatus
        );
        mockAdapter.getToken.mockResolvedValue({
            type: "web-push",
            subscription: {
                endpoint: "https://push.example.com",
                keys: { p256dh: "test-p256dh", auth: "test-auth" },
            },
        } satisfies PushTokenPayload);
        mockTokensApi.hasAny.get.mockResolvedValue({ data: true });

        const { result } = renderHook(() => useNotificationStatus(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current).toEqual({
                permissionStatus: "granted",
                permissionGranted: true,
                hasLocalCapability: true,
                hasBackendToken: true,
            });
        });
    });

    test("should report hasBackendToken when backend confirms token", async ({
        queryWrapper,
    }: WalletTestFixtures) => {
        mockAdapter.getPermissionStatus.mockResolvedValue(
            "granted" satisfies NotificationPermissionStatus
        );
        mockTokensApi.hasAny.get.mockResolvedValue({ data: true });

        const { result } = renderHook(() => useNotificationStatus(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current).toEqual({
                permissionStatus: "granted",
                permissionGranted: true,
                hasLocalCapability: false,
                hasBackendToken: true,
            });
        });
    });

    test("should default to false values when queries have not resolved", ({
        queryWrapper,
    }: WalletTestFixtures) => {
        mockAdapter.getPermissionStatus.mockReturnValue(
            new Promise(() => {}) as Promise<NotificationPermissionStatus>
        );

        const { result } = renderHook(() => useNotificationStatus(), {
            wrapper: queryWrapper.wrapper,
        });

        expect(result.current).toEqual({
            permissionStatus: "prompt",
            permissionGranted: false,
            hasLocalCapability: false,
            hasBackendToken: false,
        });
    });

    test("should update localToken and permission when token-update event fires", async ({
        queryWrapper,
    }: WalletTestFixtures) => {
        mockAdapter.getPermissionStatus.mockResolvedValue(
            "denied" satisfies NotificationPermissionStatus
        );

        const { notificationKey } = await import(
            "@/module/notification/queryKeys/notification"
        );

        renderHook(() => useNotificationStatus(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(mockAdapter.getPermissionStatus).toHaveBeenCalled();
        });

        const tokenPayload: PushTokenPayload = {
            type: "fcm",
            token: "event-delivered-token",
        };
        mockAdapter.events.dispatchEvent(
            new CustomEvent("token-update", { detail: tokenPayload })
        );

        await waitFor(() => {
            expect(
                queryWrapper.client.getQueryData(
                    notificationKey.push.localToken
                )
            ).toEqual(tokenPayload);
            expect(
                queryWrapper.client.getQueryData(
                    notificationKey.push.permission
                )
            ).toBe("granted");
        });
    });
});
