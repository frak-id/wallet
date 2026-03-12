import {
    getNotificationAdapter,
    type NotificationInitResult,
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

vi.mock("@frak-labs/wallet-shared", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("@frak-labs/wallet-shared")>();
    return {
        ...actual,
        getNotificationAdapter: vi.fn(() => ({
            isSupported: vi.fn().mockReturnValue(false),
            getPermissionStatus: vi.fn().mockReturnValue("default"),
            requestPermission: vi.fn().mockResolvedValue("granted"),
            subscribe: vi.fn().mockResolvedValue(undefined),
            unsubscribe: vi.fn().mockResolvedValue(undefined),
            showLocalNotification: vi.fn().mockResolvedValue(undefined),
            initPromise: Promise.resolve({
                permissionGranted: false,
                localToken: null,
            }),
        })),
        authenticatedWalletApi: {
            notifications: { tokens: mockTokensApi },
        },
    };
});

describe.sequential("useNotificationStatus", () => {
    beforeEach(
        ({ mockNotificationAdapter, queryWrapper }: WalletTestFixtures) => {
            queryWrapper.client.clear();

            mockNotificationAdapter.isSupported
                .mockReset()
                .mockReturnValue(false);
            mockNotificationAdapter.getPermissionStatus
                .mockReset()
                .mockReturnValue("default");
            mockNotificationAdapter.requestPermission
                .mockReset()
                .mockResolvedValue("granted");
            mockNotificationAdapter.subscribe.mockReset();
            mockNotificationAdapter.unsubscribe
                .mockReset()
                .mockResolvedValue(undefined);
            mockNotificationAdapter.showLocalNotification
                .mockReset()
                .mockResolvedValue(undefined);
            mockNotificationAdapter.initPromise = Promise.resolve({
                permissionGranted: false,
                localToken: null,
            });

            mockTokensApi.hasAny.get
                .mockReset()
                .mockResolvedValue({ data: false });
            mockTokensApi.put.mockReset().mockResolvedValue(undefined);
            mockTokensApi.delete.mockReset().mockResolvedValue(undefined);

            vi.mocked(getNotificationAdapter).mockReturnValue(
                mockNotificationAdapter
            );
        }
    );

    test("should return not supported when adapter reports unsupported", ({
        mockNotificationAdapter,
        queryWrapper,
    }: WalletTestFixtures) => {
        mockNotificationAdapter.isSupported.mockReturnValue(false);

        const { result } = renderHook(() => useNotificationStatus(), {
            wrapper: queryWrapper.wrapper,
        });

        expect(result.current).toEqual({ isSupported: false });
    });

    test("should return permissionGranted when initPromise reports granted", async ({
        mockNotificationAdapter,
        queryWrapper,
    }: WalletTestFixtures) => {
        mockNotificationAdapter.isSupported.mockReturnValue(true);
        mockNotificationAdapter.initPromise = Promise.resolve({
            permissionGranted: true,
            localToken: null,
        } satisfies NotificationInitResult);

        vi.mocked(getNotificationAdapter).mockReturnValue(
            mockNotificationAdapter
        );

        const { result } = renderHook(() => useNotificationStatus(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current).toEqual({
                isSupported: true,
                permissionGranted: true,
                hasLocalCapability: false,
                hasBackendToken: false,
            });
        });
    });

    test("should report hasLocalCapability when initPromise has a localToken", async ({
        mockNotificationAdapter,
        queryWrapper,
    }: WalletTestFixtures) => {
        mockNotificationAdapter.isSupported.mockReturnValue(true);
        mockNotificationAdapter.initPromise = Promise.resolve({
            permissionGranted: true,
            localToken: {
                type: "web-push",
                subscription: {
                    endpoint: "https://push.example.com",
                    keys: { p256dh: "test-p256dh", auth: "test-auth" },
                },
            },
        } satisfies NotificationInitResult);
        mockTokensApi.hasAny.get.mockResolvedValue({ data: true });

        vi.mocked(getNotificationAdapter).mockReturnValue(
            mockNotificationAdapter
        );

        const { result } = renderHook(() => useNotificationStatus(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current).toEqual({
                isSupported: true,
                permissionGranted: true,
                hasLocalCapability: true,
                hasBackendToken: true,
            });
        });
    });

    test("should report hasBackendToken when backend confirms token", async ({
        mockNotificationAdapter,
        queryWrapper,
    }: WalletTestFixtures) => {
        mockNotificationAdapter.isSupported.mockReturnValue(true);
        mockNotificationAdapter.initPromise = Promise.resolve({
            permissionGranted: true,
            localToken: null,
        });
        mockTokensApi.hasAny.get.mockResolvedValue({ data: true });

        vi.mocked(getNotificationAdapter).mockReturnValue(
            mockNotificationAdapter
        );

        const { result } = renderHook(() => useNotificationStatus(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current).toEqual({
                isSupported: true,
                permissionGranted: true,
                hasLocalCapability: false,
                hasBackendToken: true,
            });
        });
    });

    test("should default to false values when queries have not resolved", ({
        mockNotificationAdapter,
        queryWrapper,
    }: WalletTestFixtures) => {
        mockNotificationAdapter.isSupported.mockReturnValue(true);
        mockNotificationAdapter.initPromise = new Promise(() => {});

        vi.mocked(getNotificationAdapter).mockReturnValue(
            mockNotificationAdapter
        );

        const { result } = renderHook(() => useNotificationStatus(), {
            wrapper: queryWrapper.wrapper,
        });

        expect(result.current).toEqual({
            isSupported: true,
            permissionGranted: false,
            hasLocalCapability: false,
            hasBackendToken: false,
        });
    });
});
