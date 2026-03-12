import type { PushTokenPayload } from "@frak-labs/wallet-shared";
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
        .mockResolvedValue("default" as NotificationPermission),
    requestPermission: vi
        .fn()
        .mockResolvedValue("granted" as NotificationPermission),
    getToken: vi.fn().mockResolvedValue(null as PushTokenPayload | null),
    subscribe: vi.fn().mockResolvedValue(undefined),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
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

        mockAdapter.getPermissionStatus
            .mockReset()
            .mockResolvedValue("default" as NotificationPermission);
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
            "granted" as NotificationPermission
        );

        const { result } = renderHook(() => useNotificationStatus(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current).toEqual({
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
            "granted" as NotificationPermission
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
            "granted" as NotificationPermission
        );
        mockTokensApi.hasAny.get.mockResolvedValue({ data: true });

        const { result } = renderHook(() => useNotificationStatus(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current).toEqual({
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
            new Promise(() => {}) as Promise<NotificationPermission>
        );

        const { result } = renderHook(() => useNotificationStatus(), {
            wrapper: queryWrapper.wrapper,
        });

        expect(result.current).toEqual({
            permissionGranted: false,
            hasLocalCapability: false,
            hasBackendToken: false,
        });
    });
});
