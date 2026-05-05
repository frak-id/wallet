import type { useReferralStatus } from "@frak-labs/wallet-shared";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WelcomeCard } from "./index";

type ReferralStatusReturn = ReturnType<typeof useReferralStatus>;

const {
    mockSubscribeToPush,
    mockOpenSettings,
    mockInvalidateQueries,
    mockUseNotificationStatus,
    mockUseSubscribeToPushNotification,
    mockIsTauri,
    mockUseReferralStatus,
    mockNavigate,
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
    // Typed against the real hook's return so per-test overrides cast to
    // a meaningful target instead of self-referencing the narrowed default.
    mockUseReferralStatus: vi.fn<() => ReturnType<typeof useReferralStatus>>(
        () =>
            ({ data: { ownedCode: null } }) as unknown as ReturnType<
                typeof useReferralStatus
            >
    ),
    mockNavigate: vi.fn(),
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

vi.mock("@frak-labs/wallet-shared", async () => {
    const actual = await vi.importActual<
        typeof import("@frak-labs/wallet-shared")
    >("@frak-labs/wallet-shared");
    return {
        ...actual,
        useReferralStatus: mockUseReferralStatus,
    };
});

vi.mock("@tanstack/react-router", async () => {
    const actual = await vi.importActual<
        typeof import("@tanstack/react-router")
    >("@tanstack/react-router");
    return {
        ...actual,
        useNavigate: () => mockNavigate,
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

// `describe.sequential` because the tests share localStorage and the
// global IntersectionObserver — running them concurrently leaves
// multiple WelcomeCard renders in the same DOM and the queries see
// elements from sibling tests.
describe.sequential("WelcomeCard", () => {
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
        mockNavigate.mockReset();
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
        // Default: user hasn't issued a code yet, so the invite slide
        // should render. Tests that need the opposite override this.
        mockUseReferralStatus.mockReturnValue({
            data: { ownedCode: null },
        } as unknown as ReferralStatusReturn);

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

    it("should render intro + invite + notification slides without visible pagination", () => {
        const { container } = render(<WelcomeCard />);

        expect(container.querySelectorAll("[data-index]")).toHaveLength(3);
        expect(
            screen.queryByRole("button", { name: /Slide / })
        ).not.toBeInTheDocument();
        expect(
            screen.getByText("wallet.welcome.invite.title")
        ).toBeInTheDocument();
        expect(
            screen.getByText("wallet.welcome.notifications.title")
        ).toBeInTheDocument();
    });

    it("should keep the swipeable slider structure", () => {
        const { container } = render(<WelcomeCard />);
        expect(container.querySelectorAll("[data-index]")).toHaveLength(3);
        // The hook resets `scrollLeft` on mount to defeat browser scroll
        // restoration; that's a single `scrollTo({ left: 0 })` call.
        expect(mockScrollTo).toHaveBeenCalledTimes(1);
        expect(mockScrollTo).toHaveBeenCalledWith(
            expect.objectContaining({ left: 0 })
        );
    });

    it("should dismiss the first slide (intro) and keep the rest", () => {
        const { container } = render(<WelcomeCard />);

        fireEvent.click(screen.getByRole("button", { name: "common.close" }));

        expect(localStorage.getItem("frak_welcome_dismissed")).toBe(
            JSON.stringify(["intro"])
        );
        expect(
            screen.queryByText("wallet.welcome.title")
        ).not.toBeInTheDocument();
        expect(
            screen.getByText("wallet.welcome.invite.title")
        ).toBeInTheDocument();
        expect(
            screen.getByText("wallet.welcome.notifications.title")
        ).toBeInTheDocument();
        expect(container.querySelectorAll("[data-index]")).toHaveLength(2);
    });

    it("should dismiss the active third (invite) slide and return to a 2-slide carousel", async () => {
        const { container } = render(<WelcomeCard />);
        const slides = container.querySelectorAll("[data-index]");

        // The mount-effect scrolls to `initialIndex` (=0) and gates the
        // IntersectionObserver via `isProgrammaticScrollRef` until the
        // next animation frame. Wait for that frame before simulating
        // the user swiping to the third slide.
        await act(
            () =>
                new Promise<void>((resolve) => {
                    requestAnimationFrame(() => resolve());
                })
        );

        // Slide order: intro (0), notifications (1), invite (2).
        act(() => {
            intersectionObserverCallback?.(
                [
                    {
                        isIntersecting: true,
                        target: slides[2],
                    } as IntersectionObserverEntry,
                ],
                {} as IntersectionObserver
            );
        });

        fireEvent.click(screen.getByRole("button", { name: "common.close" }));

        expect(localStorage.getItem("frak_welcome_dismissed")).toBe(
            JSON.stringify(["invite"])
        );
        expect(
            screen.queryByText("wallet.welcome.invite.title")
        ).not.toBeInTheDocument();
        expect(screen.getByText("wallet.welcome.title")).toBeInTheDocument();
        expect(
            screen.getByText("wallet.welcome.notifications.title")
        ).toBeInTheDocument();
        expect(container.querySelectorAll("[data-index]")).toHaveLength(2);
    });

    it("should hide the whole card when all slides are already dismissed", () => {
        localStorage.setItem(
            "frak_welcome_dismissed",
            JSON.stringify(["intro", "invite", "notifications"])
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

        // intro + invite remain (2 slides)
        expect(container.querySelectorAll("[data-index]")).toHaveLength(2);
        expect(
            screen.queryByText("wallet.welcome.notifications.title")
        ).not.toBeInTheDocument();
    });

    it("should hide the invite slide when the wallet already has an active referral code", () => {
        // Partial of `UseQueryResult` is enough for what the component
        // reads (`data.ownedCode`); the cast bridges to the full type.
        mockUseReferralStatus.mockReturnValue({
            data: {
                ownedCode: {
                    code: "OLDOLD",
                    createdAt: "2026-04-30T00:00:00Z",
                },
            },
        } as unknown as ReferralStatusReturn);

        const { container } = render(<WelcomeCard />);

        expect(
            screen.queryByText("wallet.welcome.invite.title")
        ).not.toBeInTheDocument();
        // intro + notifications remain
        expect(container.querySelectorAll("[data-index]")).toHaveLength(2);
    });

    it("should navigate to /profile/referral when the invite slide is clicked", () => {
        const { container } = render(<WelcomeCard />);

        // Slide order: intro (0), notifications (1), invite (2).
        const inviteCard = container
            .querySelectorAll("[data-index]")[2]
            ?.querySelector("[role='button']") as HTMLElement;
        fireEvent.click(inviteCard);

        expect(mockNavigate).toHaveBeenCalledWith({ to: "/profile/referral" });
    });

    it("falls back to a hidden card when the user has a code AND has dismissed the rest", () => {
        // Partial of `UseQueryResult` is enough for what the component
        // reads (`data.ownedCode`); the cast bridges to the full type.
        mockUseReferralStatus.mockReturnValue({
            data: {
                ownedCode: {
                    code: "OLDOLD",
                    createdAt: "2026-04-30T00:00:00Z",
                },
            },
        } as unknown as ReferralStatusReturn);
        localStorage.setItem(
            "frak_welcome_dismissed",
            JSON.stringify(["intro", "notifications"])
        );

        const { container } = render(<WelcomeCard />);

        expect(container).toBeEmptyDOMElement();
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

        // intro + invite remain (2 slides)
        expect(container.querySelectorAll("[data-index]")).toHaveLength(2);
        expect(
            screen.queryByText("wallet.welcome.notifications.title")
        ).not.toBeInTheDocument();
    });
});
