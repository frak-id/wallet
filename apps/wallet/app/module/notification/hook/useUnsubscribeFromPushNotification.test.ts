import { act, renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import * as NotificationContext from "@/module/notification/context/NotificationContext";
import { useUnsubscribeFromPushNotification } from "@/module/notification/hook/useUnsubscribeFromPushNotification";
import {
    beforeEach,
    describe,
    expect,
    test,
    type WalletTestFixtures,
} from "@/tests/vitest-fixtures";

vi.mock("@/module/notification/context/NotificationContext", () => ({
    useNotificationContext: vi.fn(() => ({
        isSubscribed: false,
        isInitialized: true,
        setIsSubscribed: vi.fn(),
        setIsInitialized: vi.fn(),
        adapter: {
            isSupported: vi.fn().mockReturnValue(true),
            getPermissionStatus: vi.fn().mockReturnValue("granted"),
            requestPermission: vi.fn().mockResolvedValue("granted"),
            subscribe: vi.fn().mockResolvedValue(undefined),
            unsubscribe: vi.fn().mockResolvedValue(undefined),
            isSubscribed: vi.fn().mockResolvedValue(false),
            initialize: vi.fn().mockResolvedValue({ isSubscribed: false }),
            showLocalNotification: vi.fn().mockResolvedValue(undefined),
        },
    })),
}));

describe.sequential("useUnsubscribeFromPushNotification", () => {
    beforeEach(
        ({ mockNotificationContext, queryWrapper }: WalletTestFixtures) => {
            queryWrapper.client.clear();

            mockNotificationContext.adapter.isSupported.mockReset();
            mockNotificationContext.adapter.getPermissionStatus.mockReset();
            mockNotificationContext.adapter.requestPermission.mockReset();
            mockNotificationContext.adapter.subscribe.mockReset();
            mockNotificationContext.adapter.unsubscribe.mockReset();
            mockNotificationContext.adapter.isSubscribed.mockReset();
            mockNotificationContext.adapter.initialize.mockReset();
            mockNotificationContext.adapter.showLocalNotification.mockReset();

            mockNotificationContext.adapter.isSupported.mockReturnValue(true);
            mockNotificationContext.adapter.getPermissionStatus.mockReturnValue(
                "granted"
            );
            mockNotificationContext.adapter.subscribe.mockResolvedValue(
                undefined
            );
            mockNotificationContext.adapter.unsubscribe.mockResolvedValue(
                undefined
            );
            mockNotificationContext.adapter.isSubscribed.mockResolvedValue(
                false
            );

            const contextValue =
                mockNotificationContext as unknown as ReturnType<
                    typeof NotificationContext.useNotificationContext
                >;
            vi.mocked(
                NotificationContext.useNotificationContext
            ).mockReturnValue(contextValue);
        }
    );

    test("should not query backend when isInitialized is false", ({
        mockNotificationContext,
        queryWrapper,
    }: WalletTestFixtures) => {
        mockNotificationContext.isInitialized = false;
        mockNotificationContext.adapter.isSubscribed.mockResolvedValue(true);

        const contextValue = mockNotificationContext as unknown as ReturnType<
            typeof NotificationContext.useNotificationContext
        >;
        vi.mocked(NotificationContext.useNotificationContext).mockReturnValue(
            contextValue
        );

        const { result } = renderHook(
            () => useUnsubscribeFromPushNotification(),
            { wrapper: queryWrapper.wrapper }
        );

        expect(result.current.hasPushToken).toBeUndefined();
        expect(
            mockNotificationContext.adapter.isSubscribed
        ).not.toHaveBeenCalled();
    });

    test("should query backend and return hasPushToken after initialization", async ({
        mockNotificationContext,
        queryWrapper,
    }: WalletTestFixtures) => {
        mockNotificationContext.isInitialized = true;
        mockNotificationContext.adapter.isSubscribed.mockResolvedValue(true);

        const contextValue = mockNotificationContext as unknown as ReturnType<
            typeof NotificationContext.useNotificationContext
        >;
        vi.mocked(NotificationContext.useNotificationContext).mockReturnValue(
            contextValue
        );

        const { result } = renderHook(
            () => useUnsubscribeFromPushNotification(),
            { wrapper: queryWrapper.wrapper }
        );

        await waitFor(() => {
            expect(result.current.hasPushToken).toBe(true);
        });
        expect(mockNotificationContext.adapter.isSubscribed).toHaveBeenCalled();
    });

    test("should respect seeded cache over late backend response", async ({
        mockNotificationContext,
        queryWrapper,
    }: WalletTestFixtures) => {
        // Simulate: isInitialized=false initially, cache seeded with true,
        // then isInitialized flips to true — the query should use the
        // seeded value, not fire a fresh backend call that could race.
        mockNotificationContext.isInitialized = false;
        mockNotificationContext.adapter.isSubscribed.mockResolvedValue(false);

        const contextValue = mockNotificationContext as unknown as ReturnType<
            typeof NotificationContext.useNotificationContext
        >;
        vi.mocked(NotificationContext.useNotificationContext).mockReturnValue(
            contextValue
        );

        const { result, rerender } = renderHook(
            () => useUnsubscribeFromPushNotification(),
            { wrapper: queryWrapper.wrapper }
        );

        // Before initialization: query disabled, no backend call
        expect(result.current.hasPushToken).toBeUndefined();

        // Seed cache (as SetupNotifications would) then enable
        const { notificationKey } = await import(
            "@/module/notification/queryKeys/notification"
        );
        queryWrapper.client.setQueryData(notificationKey.push.tokenCount, true);
        mockNotificationContext.isInitialized = true;

        rerender();

        await waitFor(() => {
            expect(result.current.hasPushToken).toBe(true);
        });
    });

    test("should call adapter.unsubscribe and update state on mutation", async ({
        mockNotificationContext,
        queryWrapper,
    }: WalletTestFixtures) => {
        mockNotificationContext.isInitialized = true;
        mockNotificationContext.adapter.isSubscribed.mockResolvedValue(true);

        const contextValue = mockNotificationContext as unknown as ReturnType<
            typeof NotificationContext.useNotificationContext
        >;
        vi.mocked(NotificationContext.useNotificationContext).mockReturnValue(
            contextValue
        );

        const { result } = renderHook(
            () => useUnsubscribeFromPushNotification(),
            { wrapper: queryWrapper.wrapper }
        );

        await waitFor(() => {
            expect(result.current.hasPushToken).toBe(true);
        });

        // After unsubscribe, adapter.isSubscribed returns false
        mockNotificationContext.adapter.isSubscribed.mockResolvedValue(false);

        await act(async () => {
            await result.current.unsubscribeFromPushAsync();
        });

        expect(
            mockNotificationContext.adapter.unsubscribe
        ).toHaveBeenCalledOnce();
        expect(mockNotificationContext.setIsSubscribed).toHaveBeenCalledWith(
            false
        );
        await waitFor(() => {
            expect(result.current.hasPushToken).toBe(false);
        });
    });
});
