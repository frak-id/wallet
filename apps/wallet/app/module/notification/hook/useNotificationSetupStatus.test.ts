import { renderHook } from "@testing-library/react";
import { vi } from "vitest";
import * as NotificationContext from "@/module/notification/context/NotificationContext";
import { useNotificationSetupStatus } from "@/module/notification/hook/useNotificationSetupStatus";
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
        setIsSubscribed: vi.fn(),
        adapter: {
            isSupported: vi.fn().mockReturnValue(false),
            getPermissionStatus: vi.fn().mockReturnValue("default"),
            requestPermission: vi.fn().mockResolvedValue("granted"),
            subscribe: vi.fn().mockResolvedValue(undefined),
            unsubscribe: vi.fn().mockResolvedValue(undefined),
            isSubscribed: vi.fn().mockResolvedValue(false),
            initialize: vi.fn().mockResolvedValue({ isSubscribed: false }),
            showLocalNotification: vi.fn().mockResolvedValue(undefined),
        },
    })),
}));

describe.sequential("useNotificationSetupStatus", () => {
    beforeEach(({ mockNotificationContext }: WalletTestFixtures) => {
        mockNotificationContext.adapter.isSupported.mockReset();
        mockNotificationContext.adapter.getPermissionStatus.mockReset();
        mockNotificationContext.adapter.requestPermission.mockReset();
        mockNotificationContext.adapter.subscribe.mockReset();
        mockNotificationContext.adapter.unsubscribe.mockReset();
        mockNotificationContext.adapter.isSubscribed.mockReset();
        mockNotificationContext.adapter.initialize.mockReset();
        mockNotificationContext.adapter.showLocalNotification.mockReset();

        mockNotificationContext.adapter.isSupported.mockReturnValue(false);
        mockNotificationContext.adapter.getPermissionStatus.mockReturnValue(
            "default"
        );
        mockNotificationContext.adapter.requestPermission.mockResolvedValue(
            "granted"
        );
        mockNotificationContext.adapter.subscribe.mockResolvedValue(undefined);
        mockNotificationContext.adapter.unsubscribe.mockResolvedValue(
            undefined
        );
        mockNotificationContext.adapter.isSubscribed.mockResolvedValue(false);
        mockNotificationContext.adapter.initialize.mockResolvedValue({
            isSubscribed: false,
        });
        mockNotificationContext.adapter.showLocalNotification.mockResolvedValue(
            undefined
        );

        const contextValue = mockNotificationContext as unknown as ReturnType<
            typeof NotificationContext.useNotificationContext
        >;
        vi.mocked(NotificationContext.useNotificationContext).mockReturnValue(
            contextValue
        );
    });

    test("should return not supported when adapter reports unsupported", ({
        mockNotificationContext,
    }: WalletTestFixtures) => {
        mockNotificationContext.adapter.isSupported.mockReturnValue(false);

        const { result } = renderHook(() => useNotificationSetupStatus());

        expect(result.current).toEqual({ isSupported: false });
        expect(
            mockNotificationContext.adapter.isSupported
        ).toHaveBeenCalledTimes(1);
    });

    test("should return supported status and permission data", ({
        mockNotificationContext,
    }: WalletTestFixtures) => {
        mockNotificationContext.adapter.isSupported.mockReturnValue(true);
        mockNotificationContext.adapter.getPermissionStatus.mockReturnValue(
            "granted"
        );

        const { result } = renderHook(() => useNotificationSetupStatus());

        expect(result.current.isSupported).toBe(true);
        expect(result.current.isNotificationAllowed).toBe(true);
        expect(result.current.isSubscribed).toBe(false);
        expect(result.current.askForNotificationPermission).toBeTypeOf(
            "function"
        );
    });

    test("should expose isSubscribed from context", ({
        mockNotificationContext,
    }: WalletTestFixtures) => {
        mockNotificationContext.isSubscribed = true;
        mockNotificationContext.adapter.isSupported.mockReturnValue(true);
        mockNotificationContext.adapter.getPermissionStatus.mockReturnValue(
            "default"
        );

        const contextValue = mockNotificationContext as unknown as ReturnType<
            typeof NotificationContext.useNotificationContext
        >;
        vi.mocked(NotificationContext.useNotificationContext).mockReturnValue(
            contextValue
        );

        const { result } = renderHook(() => useNotificationSetupStatus());

        expect(result.current.isSupported).toBe(true);
        expect(result.current.isSubscribed).toBe(true);
    });

    test("should call adapter.requestPermission when callback is invoked", async ({
        mockNotificationContext,
    }: WalletTestFixtures) => {
        mockNotificationContext.adapter.isSupported.mockReturnValue(true);
        mockNotificationContext.adapter.getPermissionStatus.mockReturnValue(
            "default"
        );

        const { result } = renderHook(() => useNotificationSetupStatus());

        await result.current.askForNotificationPermission?.();
        expect(
            mockNotificationContext.adapter.requestPermission
        ).toHaveBeenCalledTimes(1);
    });

    test("should handle adapter permission request errors", async ({
        mockNotificationContext,
    }: WalletTestFixtures) => {
        const consoleErrorSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => {});
        const mockError = new Error("Permission denied");

        mockNotificationContext.adapter.isSupported.mockReturnValue(true);
        mockNotificationContext.adapter.getPermissionStatus.mockReturnValue(
            "default"
        );
        mockNotificationContext.adapter.requestPermission.mockRejectedValue(
            mockError
        );

        const { result } = renderHook(() => useNotificationSetupStatus());

        await result.current.askForNotificationPermission?.();

        expect(consoleErrorSpy).toHaveBeenCalledWith(
            "Failed to request notification permission: ",
            mockError
        );

        consoleErrorSpy.mockRestore();
    });
});
