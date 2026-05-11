import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { vi } from "vitest";
import type {
    NotificationPermissionStatus,
    PushTokenPayload,
} from "@/module/notification/adapter";
import { notificationOptOutStore } from "@/module/notification/stores/notificationOptOutStore";
import {
    beforeEach,
    describe,
    expect,
    test,
    type WalletTestFixtures,
} from "@/tests/vitest-fixtures";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
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

vi.mock("@frak-labs/design-system/components/Switch", () => ({
    Switch: ({
        checked,
        disabled,
        onCheckedChange,
    }: {
        checked: boolean;
        disabled?: boolean;
        onCheckedChange: (v: boolean) => void;
    }) => (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onCheckedChange(!checked)}
        >
            switch
        </button>
    ),
}));

const ProfilePreferencesCardPromise = import("./index").then(
    (m) => m.ProfilePreferencesCard
);

describe.sequential("ProfilePreferencesCard › NotificationRow", () => {
    beforeEach(({ queryWrapper }: WalletTestFixtures) => {
        queryWrapper.client.clear();
        mockAdapter.openSettings.mockReset().mockResolvedValue(undefined);
        mockAdapter.subscribe.mockReset().mockResolvedValue(undefined);
        mockAdapter.unsubscribe.mockReset().mockResolvedValue(undefined);

        notificationOptOutStore.getState().setOptedOut(true);

        mockUseNotificationStatus.mockReturnValue({
            permissionStatus: "denied" satisfies NotificationPermissionStatus,
            permissionGranted: false,
            isReady: true,
            hasLocalCapability: false,
            hasBackendToken: false,
        });
    });

    test("should clear opt-out flag and call openSettings when toggling on while denied", async ({
        queryWrapper,
    }: WalletTestFixtures) => {
        const ProfilePreferencesCard =
            (await ProfilePreferencesCardPromise) as ComponentType;

        render(<ProfilePreferencesCard />, {
            wrapper: queryWrapper.wrapper,
        });

        const switchEl = screen.getByRole("switch");
        await act(async () => {
            fireEvent.click(switchEl);
        });

        expect(mockAdapter.openSettings).toHaveBeenCalledOnce();
        expect(notificationOptOutStore.getState().optedOut).toBe(false);
    });
});
