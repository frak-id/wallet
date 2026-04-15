import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WelcomeCard } from "./index";
import * as styles from "./index.css";

const {
    mockSubscribeToPush,
    mockOpenSettings,
    mockInvalidateQueries,
    mockUseNotificationStatus,
    mockUseSubscribeToPushNotification,
    mockIsTauri,
} = vi.hoisted(() => ({
    mockSubscribeToPush: vi.fn(),
    mockOpenSettings: vi.fn(),
    mockInvalidateQueries: vi.fn(),
    mockUseNotificationStatus: vi.fn(() => ({
        permissionStatus: "prompt",
        isReady: true,
        hasLocalCapability: false,
    })),
    mockUseSubscribeToPushNotification: vi.fn(() => ({
        subscribeToPush: vi.fn(),
        isPending: false,
    })),
    mockIsTauri: vi.fn(() => false),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
    Trans: ({ i18nKey }: { i18nKey: string }) => i18nKey,
}));

vi.mock("@frak-labs/app-essentials/utils/platform", () => ({
    isTauri: mockIsTauri,
}));

vi.mock("@tanstack/react-query", async () => {
    const actual = await vi.importActual("@tanstack/react-query");

    return {
        ...actual,
        useQueryClient: () => ({
            invalidateQueries: mockInvalidateQueries,
        }),
    };
});

vi.mock("@/module/notification/adapter", () => ({
    notificationAdapter: {
        openSettings: mockOpenSettings,
    },
}));

vi.mock("@/module/notification/hook/useNotificationSetupStatus", () => ({
    useNotificationStatus: mockUseNotificationStatus,
}));

vi.mock("@/module/notification/hook/useSubscribeToPushNotification", () => ({
    useSubscribeToPushNotification: mockUseSubscribeToPushNotification,
}));

describe("WelcomeCard", () => {
    const originalIntersectionObserver = global.IntersectionObserver;
    const mockScrollTo = vi.fn();
    let intersectionObserverCallback: IntersectionObserverCallback | null =
        null;

    beforeEach(() => {
        localStorage.clear();
        HTMLElement.prototype.scrollTo = mockScrollTo;
        mockScrollTo.mockReset();
        intersectionObserverCallback = null;
        mockSubscribeToPush.mockReset();
        mockOpenSettings.mockReset();
        mockInvalidateQueries.mockReset();
        mockIsTauri.mockReturnValue(false);
        mockUseNotificationStatus.mockReturnValue({
            permissionStatus: "prompt",
            isReady: true,
            hasLocalCapability: false,
        });
        mockUseSubscribeToPushNotification.mockReturnValue({
            subscribeToPush: mockSubscribeToPush,
            isPending: false,
        });

        class MockIntersectionObserver {
            readonly root = null;
            readonly rootMargin = "";
            readonly scrollMargin = "";
            readonly thresholds = [];

            constructor(callback: IntersectionObserverCallback) {
                intersectionObserverCallback = callback;
            }

            disconnect = vi.fn();
            observe = vi.fn();
            takeRecords = vi.fn(() => []);
            unobserve = vi.fn();
        }

        global.IntersectionObserver =
            MockIntersectionObserver as unknown as typeof IntersectionObserver;
    });

    afterEach(() => {
        global.IntersectionObserver = originalIntersectionObserver;
    });

    it("should render multiple welcome slides without visible pagination", () => {
        const { container } = render(<WelcomeCard />);

        expect(container.querySelectorAll("[data-index]")).toHaveLength(2);
        expect(
            screen.queryByRole("button", { name: /Slide / })
        ).not.toBeInTheDocument();
        expect(
            screen.getByText("wallet.welcome.notifications.title")
        ).toBeInTheDocument();
    });

    it("should keep the swipeable slider structure", () => {
        const { container } = render(<WelcomeCard />);
        expect(container.querySelectorAll("[data-index]")).toHaveLength(2);
        expect(mockScrollTo).not.toHaveBeenCalled();
    });

    it("should dismiss the first slide and keep the second one", () => {
        const { container } = render(<WelcomeCard />);

        fireEvent.click(screen.getByRole("button", { name: "common.close" }));

        expect(localStorage.getItem("frak_welcome_dismissed")).toBe(
            JSON.stringify(["intro"])
        );
        expect(
            screen.queryByText("wallet.welcome.title")
        ).not.toBeInTheDocument();
        expect(
            screen.getByText("wallet.welcome.notifications.title")
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "common.close" })
        ).toBeInTheDocument();
        expect(container.querySelectorAll("[data-index]")).toHaveLength(1);
    });

    it("should dismiss the current second slide and return to the first one", () => {
        const { container } = render(<WelcomeCard />);
        const slides = container.querySelectorAll("[data-index]");

        act(() => {
            intersectionObserverCallback?.(
                [
                    {
                        isIntersecting: true,
                        target: slides[1],
                    } as IntersectionObserverEntry,
                ],
                {} as IntersectionObserver
            );
        });

        fireEvent.click(screen.getByRole("button", { name: "common.close" }));

        expect(localStorage.getItem("frak_welcome_dismissed")).toBe(
            JSON.stringify(["notifications"])
        );
        expect(
            screen.queryByText("wallet.welcome.notifications.title")
        ).not.toBeInTheDocument();
        expect(screen.getByText("wallet.welcome.title")).toBeInTheDocument();
        expect(container.querySelectorAll("[data-index]")).toHaveLength(1);
    });

    it("should hide the whole card when all slides are already dismissed", () => {
        localStorage.setItem(
            "frak_welcome_dismissed",
            JSON.stringify(["intro", "notifications"])
        );

        const { container } = render(<WelcomeCard />);

        expect(container).toBeEmptyDOMElement();
    });

    it("should hide the notification slide when notifications are already enabled", () => {
        mockUseNotificationStatus.mockReturnValue({
            permissionStatus: "granted",
            isReady: true,
            hasLocalCapability: true,
        });

        const { container } = render(<WelcomeCard />);
        const slider = container.querySelector(`.${styles.slider.single}`);
        const slide = container.querySelector(`.${styles.slide.single}`);

        expect(container.querySelectorAll("[data-index]")).toHaveLength(1);
        expect(
            screen.queryByText("wallet.welcome.notifications.title")
        ).not.toBeInTheDocument();
        expect(slider).toBeTruthy();
        expect(slide).toBeTruthy();
    });

    it("should subscribe to push when tapping the notification action in prompt state", () => {
        render(<WelcomeCard />);

        const notificationCard = screen
            .getByText("wallet.activateNotifications")
            .closest("[role='button']") as HTMLElement;
        fireEvent.click(notificationCard);

        expect(mockSubscribeToPush).toHaveBeenCalledOnce();
    });

    it("should open settings when tapping the notification action in native denied state", async () => {
        mockIsTauri.mockReturnValue(true);
        mockUseNotificationStatus.mockReturnValue({
            permissionStatus: "denied",
            isReady: true,
            hasLocalCapability: false,
        });
        mockOpenSettings.mockResolvedValue(undefined);

        render(<WelcomeCard />);

        const notificationCard = screen
            .getByText("wallet.openNotificationSettings")
            .closest("[role='button']") as HTMLElement;
        fireEvent.click(notificationCard);

        expect(mockOpenSettings).toHaveBeenCalledOnce();
        await Promise.resolve();
        expect(mockInvalidateQueries).toHaveBeenCalledWith({
            queryKey: ["notification", "push", "permission"],
        });
    });

    it("should keep the notification slide hidden while notification status is unresolved", () => {
        mockUseNotificationStatus.mockReturnValue({
            permissionStatus: "prompt",
            isReady: false,
            hasLocalCapability: false,
        });

        const { container } = render(<WelcomeCard />);

        expect(container.querySelectorAll("[data-index]")).toHaveLength(1);
        expect(
            screen.queryByText("wallet.welcome.notifications.title")
        ).not.toBeInTheDocument();
    });
});
