import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

const mockUnsubscribeFromPush = vi.fn();

vi.mock("@frak-labs/app-essentials/utils/platform", () => ({
    isTauri: vi.fn(() => false),
    isAndroid: vi.fn(() => false),
    isIOS: vi.fn(() => false),
}));

vi.mock("@/module/notification/adapter", () => ({
    notificationAdapter: {
        openSettings: vi.fn(() => Promise.resolve()),
        events: new EventTarget(),
        initPromise: Promise.resolve(),
    },
}));

vi.mock("@/module/notification/hook/useNotificationSetupStatus", () => ({
    useNotificationStatus: vi.fn(() => ({
        hasLocalCapability: true,
    })),
}));

vi.mock(
    "@/module/notification/hook/useUnsubscribeFromPushNotification",
    () => ({
        useUnsubscribeFromPushNotification: vi.fn(() => ({
            unsubscribeFromPush: mockUnsubscribeFromPush,
            isPending: false,
        })),
    })
);

vi.mock("react-i18next", () => ({
    Trans: ({ i18nKey }: { i18nKey: string }) => <span>{i18nKey}</span>,
}));

vi.mock("@/module/notification/queryKeys/notification", () => ({
    notificationKey: {
        push: {
            permission: ["notification", "push", "permission"],
        },
    },
}));

const mockInvalidateQueries = vi.fn(() => Promise.resolve());

vi.mock("@tanstack/react-query", () => ({
    useQueryClient: () => ({
        invalidateQueries: mockInvalidateQueries,
    }),
}));

describe("RemoveAllNotification", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("when hasLocalCapability is false", () => {
        test("should render nothing", async () => {
            const { useNotificationStatus } = await import(
                "@/module/notification/hook/useNotificationSetupStatus"
            );
            vi.mocked(useNotificationStatus).mockReturnValue({
                hasLocalCapability: false,
                permissionStatus: "prompt",
                permissionGranted: false,
                isReady: true,
                hasBackendToken: false,
            });

            const { RemoveAllNotification } = await import("./index");
            const { container } = render(<RemoveAllNotification />);
            expect(container.innerHTML).toBe("");
        });
    });

    describe("on web (non-Tauri)", () => {
        beforeEach(async () => {
            const platform = await import(
                "@frak-labs/app-essentials/utils/platform"
            );
            vi.mocked(platform.isTauri).mockReturnValue(false);

            const { useNotificationStatus } = await import(
                "@/module/notification/hook/useNotificationSetupStatus"
            );
            vi.mocked(useNotificationStatus).mockReturnValue({
                hasLocalCapability: true,
                permissionStatus: "granted",
                permissionGranted: true,
                isReady: true,
                hasBackendToken: true,
            });
        });

        test("should show unsubscribe button", async () => {
            const { RemoveAllNotification } = await import("./index");
            render(<RemoveAllNotification />);

            expect(
                screen.getByText("Unsubscribe from all notifications")
            ).toBeInTheDocument();
        });

        test("should call unsubscribeFromPush on click", async () => {
            const { RemoveAllNotification } = await import("./index");
            render(<RemoveAllNotification />);

            const button = screen.getByRole("button");
            fireEvent.click(button);

            expect(mockUnsubscribeFromPush).toHaveBeenCalledOnce();
        });
    });

    describe("on native (Tauri)", () => {
        beforeEach(async () => {
            const platform = await import(
                "@frak-labs/app-essentials/utils/platform"
            );
            vi.mocked(platform.isTauri).mockReturnValue(true);

            const { useNotificationStatus } = await import(
                "@/module/notification/hook/useNotificationSetupStatus"
            );
            vi.mocked(useNotificationStatus).mockReturnValue({
                hasLocalCapability: true,
                permissionStatus: "granted",
                permissionGranted: true,
                isReady: true,
                hasBackendToken: true,
            });
        });

        test("should show manage notifications button", async () => {
            const { RemoveAllNotification } = await import("./index");
            render(<RemoveAllNotification />);

            expect(
                screen.getByText("wallet.manageNotifications")
            ).toBeInTheDocument();
        });

        test("should call openSettings and invalidate permission on click", async () => {
            const { notificationAdapter } = await import(
                "@/module/notification/adapter"
            );
            const { RemoveAllNotification } = await import("./index");
            render(<RemoveAllNotification />);

            const button = screen.getByRole("button");
            fireEvent.click(button);

            await waitFor(() => {
                expect(notificationAdapter.openSettings).toHaveBeenCalledOnce();
                expect(mockInvalidateQueries).toHaveBeenCalledWith({
                    queryKey: ["notification", "push", "permission"],
                });
            });
        });

        test("should not call unsubscribeFromPush", async () => {
            const { RemoveAllNotification } = await import("./index");
            render(<RemoveAllNotification />);

            const button = screen.getByRole("button");
            fireEvent.click(button);

            expect(mockUnsubscribeFromPush).not.toHaveBeenCalled();
        });
    });
});
