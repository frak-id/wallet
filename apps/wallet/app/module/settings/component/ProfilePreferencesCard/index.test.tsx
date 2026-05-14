import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { vi } from "vitest";
import type {
    NotificationPermissionStatus,
    PushTokenPayload,
} from "@/module/notification/adapter";
import {
    beforeEach,
    describe,
    expect,
    test,
    type WalletTestFixtures,
} from "@/tests/vitest-fixtures";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) => {
            if (key === "wallet.profile.manageNotifications")
                return "Manage notifications";
            if (key === "wallet.profile.enableNotifications")
                return "Enable notifications";
            return fallback ?? key;
        },
        i18n: { language: "fr" },
    }),
}));

vi.mock("@frak-labs/app-essentials/utils/platform", async (importOriginal) => {
    const actual =
        await importOriginal<
            typeof import("@frak-labs/app-essentials/utils/platform")
        >();
    return {
        ...actual,
        IS_TAURI: true,
    };
});

const mockUseNotificationStatus = vi.hoisted(() => vi.fn());
vi.mock("@/module/notification/hook/useNotificationSetupStatus", () => ({
    useNotificationStatus: mockUseNotificationStatus,
}));

const mockSubscribeAsync = vi.hoisted(() =>
    vi.fn().mockResolvedValue(undefined)
);
vi.mock("@/module/notification/hook/useSubscribeToPushNotification", () => ({
    useSubscribeToPushNotification: () => ({
        subscribeToPush: vi.fn(),
        subscribeToPushAsync: mockSubscribeAsync,
        isPending: false,
    }),
}));

vi.mock(
    "@/module/notification/hook/useUnsubscribeFromPushNotification",
    () => ({
        useUnsubscribeFromPushNotification: () => ({
            unsubscribeFromPush: vi.fn(),
            unsubscribeFromPushAsync: vi.fn().mockResolvedValue(undefined),
            isPending: false,
        }),
    })
);

const mockAdapter = vi.hoisted(() => ({
    isSupported: vi.fn(() => true),
    getPermissionStatus: vi
        .fn()
        .mockResolvedValue("denied" satisfies NotificationPermissionStatus),
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

vi.mock("@/module/biometrics/stores/biometricsStore", () => ({
    biometricsStore: Object.assign(() => false, {
        getState: () => ({}),
    }),
    selectBiometricsEnabled: () => false,
    selectBiometricsLockTimeout: () => "immediate",
    selectIsAvailable: () => false,
}));

vi.mock("@/module/biometrics/hooks/useBiometryLabel", () => ({
    useBiometryLabel: () => "Face ID",
}));

vi.mock("@/module/biometrics/utils/biometrics", () => ({
    authenticateWithBiometrics: vi.fn(),
}));

const ProfilePreferencesCardPromise = import("./index").then(
    (m) => m.ProfilePreferencesCard
);

describe.sequential("ProfilePreferencesCard › Tauri NotificationRow", () => {
    beforeEach(({ queryWrapper }: WalletTestFixtures) => {
        queryWrapper.client.clear();
        mockAdapter.openSettings.mockReset().mockResolvedValue(undefined);
        mockSubscribeAsync.mockReset().mockResolvedValue(undefined);
    });

    test("should render 'Manage notifications' and call openSettings when permission is granted", async ({
        queryWrapper,
    }: WalletTestFixtures) => {
        mockUseNotificationStatus.mockReturnValue({
            permissionStatus: "granted" satisfies NotificationPermissionStatus,
            permissionGranted: true,
            isReady: true,
            hasLocalCapability: true,
            hasBackendToken: true,
        });

        const ProfilePreferencesCard =
            (await ProfilePreferencesCardPromise) as ComponentType;
        render(<ProfilePreferencesCard />, {
            wrapper: queryWrapper.wrapper,
        });

        const button = screen.getByRole("button", {
            name: /manage notifications/i,
        });
        await act(async () => {
            fireEvent.click(button);
        });

        expect(mockAdapter.openSettings).toHaveBeenCalledOnce();
        expect(mockSubscribeAsync).not.toHaveBeenCalled();
    });

    test("should render 'Enable notifications' and call subscribe when permission is prompt", async ({
        queryWrapper,
    }: WalletTestFixtures) => {
        mockUseNotificationStatus.mockReturnValue({
            permissionStatus: "prompt" satisfies NotificationPermissionStatus,
            permissionGranted: false,
            isReady: true,
            hasLocalCapability: false,
            hasBackendToken: false,
        });

        const ProfilePreferencesCard =
            (await ProfilePreferencesCardPromise) as ComponentType;
        render(<ProfilePreferencesCard />, {
            wrapper: queryWrapper.wrapper,
        });

        const button = screen.getByRole("button", {
            name: /enable notifications/i,
        });
        await act(async () => {
            fireEvent.click(button);
        });

        expect(mockSubscribeAsync).toHaveBeenCalledOnce();
        expect(mockAdapter.openSettings).not.toHaveBeenCalled();
    });

    test("should render 'Enable notifications' and call openSettings when permission is denied", async ({
        queryWrapper,
    }: WalletTestFixtures) => {
        mockUseNotificationStatus.mockReturnValue({
            permissionStatus: "denied" satisfies NotificationPermissionStatus,
            permissionGranted: false,
            isReady: true,
            hasLocalCapability: false,
            hasBackendToken: false,
        });

        const ProfilePreferencesCard =
            (await ProfilePreferencesCardPromise) as ComponentType;
        render(<ProfilePreferencesCard />, {
            wrapper: queryWrapper.wrapper,
        });

        const button = screen.getByRole("button", {
            name: /enable notifications/i,
        });
        await act(async () => {
            fireEvent.click(button);
        });

        expect(mockAdapter.openSettings).toHaveBeenCalledOnce();
        expect(mockSubscribeAsync).not.toHaveBeenCalled();
    });
});
