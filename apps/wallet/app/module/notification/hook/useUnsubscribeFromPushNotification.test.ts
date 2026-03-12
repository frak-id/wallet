import { getNotificationAdapter } from "@frak-labs/wallet-shared";
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

vi.mock("@frak-labs/wallet-shared", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("@frak-labs/wallet-shared")>();
    return {
        ...actual,
        getNotificationAdapter: vi.fn(() => ({
            isSupported: vi.fn().mockReturnValue(true),
            getPermissionStatus: vi.fn().mockReturnValue("granted"),
            requestPermission: vi.fn().mockResolvedValue("granted"),
            subscribe: vi.fn().mockResolvedValue(undefined),
            unsubscribe: vi.fn().mockResolvedValue(undefined),
            showLocalNotification: vi.fn().mockResolvedValue(undefined),
            initPromise: Promise.resolve({
                permissionGranted: true,
                localToken: null,
            }),
        })),
        authenticatedWalletApi: {
            notifications: { tokens: mockTokensApi },
        },
    };
});

describe.sequential("useUnsubscribeFromPushNotification", () => {
    beforeEach(
        ({ mockNotificationAdapter, queryWrapper }: WalletTestFixtures) => {
            queryWrapper.client.clear();

            mockNotificationAdapter.isSupported
                .mockReset()
                .mockReturnValue(true);
            mockNotificationAdapter.unsubscribe
                .mockReset()
                .mockResolvedValue(undefined);

            mockTokensApi.delete.mockReset().mockResolvedValue(undefined);

            vi.mocked(getNotificationAdapter).mockReturnValue(
                mockNotificationAdapter
            );
        }
    );

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
        mockNotificationAdapter,
        queryWrapper,
    }: WalletTestFixtures) => {
        const { result } = renderHook(
            () => useUnsubscribeFromPushNotification(),
            { wrapper: queryWrapper.wrapper }
        );

        await act(async () => {
            await result.current.unsubscribeFromPushAsync();
        });

        expect(mockNotificationAdapter.unsubscribe).toHaveBeenCalledOnce();
        expect(mockTokensApi.delete).toHaveBeenCalledOnce();
    });

    test("should update query cache on successful unsubscribe", async ({
        mockNotificationAdapter,
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

        expect(mockNotificationAdapter.unsubscribe).toHaveBeenCalledOnce();
        expect(mockTokensApi.delete).toHaveBeenCalledOnce();

        const localState = queryWrapper.client.getQueryData(
            notificationKey.push.localState
        ) as { permissionGranted: boolean; localToken: null } | undefined;
        expect(localState).toEqual({
            permissionGranted: false,
            localToken: null,
        });

        const backendToken = queryWrapper.client.getQueryData(
            notificationKey.push.backendToken
        );
        expect(backendToken).toBe(false);
    });

    test("should report error state when adapter.unsubscribe fails", async ({
        mockNotificationAdapter,
        queryWrapper,
    }: WalletTestFixtures) => {
        mockNotificationAdapter.unsubscribe.mockRejectedValue(
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
