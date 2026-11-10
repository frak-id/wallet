import * as coreSdk from "@frak-labs/core-sdk";
import { type PendingRewardSummary, sdkConfigStore } from "@frak-labs/core-sdk";
import {
    getInstallUrl,
    getMergeToken,
    REFERRAL_SUCCESS_EVENT,
} from "@frak-labs/core-sdk/actions";
import {
    act,
    fireEvent,
    render,
    screen,
    waitFor,
} from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as useClientReadyHook from "@/hooks/useClientReady";
import * as usePlacementHook from "@/hooks/usePlacement";
import { useRewardSummary } from "@/hooks/useRewardSummary";
import { hasInlineReminder } from "@/rewards/inlineSurfaces";
import { Banner } from "./Banner";

const coreSdkMock = vi.hoisted(() => ({ isInAppBrowser: false }));

vi.mock("@frak-labs/core-sdk", async () => {
    const actual = await vi.importActual<typeof import("@frak-labs/core-sdk")>(
        "@frak-labs/core-sdk"
    );
    return {
        ...actual,
        get isInAppBrowser() {
            return coreSdkMock.isInAppBrowser;
        },
        trackEvent: vi.fn(),
        formatAmount: vi.fn(
            (amount: number, currency?: string) =>
                `${amount} ${currency ?? "eur"}`
        ),
    };
});

vi.mock("@frak-labs/core-sdk/actions", async () => {
    const actual = await vi.importActual<
        typeof import("@frak-labs/core-sdk/actions")
    >("@frak-labs/core-sdk/actions");
    return { ...actual, getInstallUrl: vi.fn(), getMergeToken: vi.fn() };
});

vi.mock("@/hooks/useClientReady", () => ({ useClientReady: vi.fn() }));
vi.mock("@/hooks/usePlacement", () => ({ usePlacement: vi.fn() }));
vi.mock("@/hooks/useLightDomStyles", () => ({ useLightDomStyles: vi.fn() }));
vi.mock("@/hooks/useRewardSummary", () => ({ useRewardSummary: vi.fn() }));
vi.mock("@/hooks/useReward", () => ({
    useReward: vi.fn(() => ({ reward: undefined, hasReward: false })),
}));

const INSTALL_URL = "https://wallet.test/i?m=abc#p=proof";
const DAY = 24 * 60 * 60 * 1000;
const CHROME_UA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

function amounts(eur: number) {
    return { eurAmount: eur, usdAmount: eur, gbpAmount: eur };
}

function pendingRewards(
    overrides: Partial<PendingRewardSummary> = {}
): PendingRewardSummary {
    return {
        total: amounts(12.5),
        cashback: amounts(12.5),
        fromFriends: amounts(0),
        count: 1,
        lockedCount: 0,
        nextUnlockAt: null,
        expiresAt: new Date(Date.now() + 4 * DAY - 3600_000).toISOString(),
        ...overrides,
    };
}

function serveSummary(
    pending: PendingRewardSummary | null,
    linked = false
): void {
    vi.mocked(useRewardSummary).mockReturnValue({
        status: "ready",
        summary: { linked, pending, earned: null },
    });
}

function trackedEvents(name: string) {
    return vi
        .mocked(coreSdk.trackEvent)
        .mock.calls.filter(([, event]) => event === name)
        .map(([, , properties]) => properties);
}

describe("Banner pending mode", () => {
    const userAgent = vi.spyOn(window.navigator, "userAgent", "get");

    beforeEach(() => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date(2026, 10, 7, 12));
        userAgent.mockReturnValue(CHROME_UA);
        coreSdkMock.isInAppBrowser = false;
        sdkConfigStore.setConfig({
            isResolved: true,
            merchantId: "merchant-1",
        });
        vi.mocked(useClientReadyHook.useClientReady).mockReturnValue({
            shouldRender: true,
            isHidden: false,
            isClientReady: true,
        });
        vi.mocked(usePlacementHook.usePlacement).mockReturnValue(undefined);
        vi.mocked(getInstallUrl).mockResolvedValue(INSTALL_URL);
        vi.mocked(getMergeToken).mockResolvedValue(null);
        serveSummary(pendingRewards());
    });

    afterEach(() => {
        vi.useRealTimers();
        sdkConfigStore.clearCache();
        window.__frakSdkConfig = undefined;
    });

    it("shows the amount, the countdown and the install link", async () => {
        const { container } = render(<Banner />);

        expect(container.querySelector(".frak-banner--pending")).not.toBeNull();
        expect(
            container.querySelector(".frak-banner__title")
        ).toHaveTextContent("You have 12.5 eur waiting");
        expect(
            container.querySelector(".frak-banner__description")
        ).toHaveTextContent(
            "Create your free Frak wallet to receive it. 4 days left."
        );
        const cta = await screen.findByRole("link", {
            name: "Claim my 12.5 eur",
        });
        expect(cta).toHaveAttribute("href", INSTALL_URL);
    });

    it.each([
        [6, "Expires today."],
        [18, "1 day left."],
    ])("words a deadline %i hours away as %s", (hours, label) => {
        serveSummary(
            pendingRewards({
                expiresAt: new Date(
                    Date.now() + hours * 3600_000
                ).toISOString(),
            })
        );

        const { container } = render(<Banner />);

        expect(
            container.querySelector(".frak-banner__description")
        ).toHaveTextContent(label);
    });

    it("stays away once the deadline has passed", () => {
        serveSummary(
            pendingRewards({
                expiresAt: new Date(Date.now() - 1000).toISOString(),
            })
        );

        const { container } = render(<Banner />);

        expect(container.querySelector(".frak-banner--pending")).toBeNull();
    });

    it("mentions the unlock date when everything is still locked", () => {
        serveSummary(
            pendingRewards({
                lockedCount: 1,
                nextUnlockAt: new Date(Date.now() + 2 * DAY).toISOString(),
            })
        );

        const { container } = render(<Banner />);

        expect(
            container.querySelector(".frak-banner__description")
        ).toHaveTextContent(/It unlocks on .+\. 4 days left\./);
    });

    it.each([
        ["nothing is pending", () => serveSummary(null)],
        ["the visitor is linked", () => serveSummary(pendingRewards(), true)],
        [
            "the reminder was dismissed",
            () =>
                sessionStorage.setItem(
                    "frak-reward-reminder-dismissed-merchant-1",
                    "1"
                ),
        ],
        [
            "the merchant is hidden",
            () =>
                vi.mocked(useClientReadyHook.useClientReady).mockReturnValue({
                    shouldRender: true,
                    isHidden: true,
                    isClientReady: true,
                }),
        ],
    ])("renders nothing when %s", (_, arrange) => {
        arrange();

        const { container } = render(<Banner />);

        expect(container.querySelector(".frak-banner")).toBeNull();
    });

    it("fetches the summary only while no other mode is active", () => {
        render(<Banner />);
        expect(useRewardSummary).toHaveBeenLastCalledWith(true);

        coreSdkMock.isInAppBrowser = true;
        render(<Banner allowInappRedirect />);
        expect(useRewardSummary).toHaveBeenLastCalledWith(false);
    });

    it("lets the in-app mode outrank pending", () => {
        coreSdkMock.isInAppBrowser = true;

        const { container } = render(<Banner allowInappRedirect />);

        expect(container.querySelector(".frak-banner--inapp")).not.toBeNull();
        expect(container.querySelector(".frak-banner--pending")).toBeNull();
    });

    it("lets a referral outrank pending", () => {
        const { container } = render(<Banner />);

        act(() => {
            window.dispatchEvent(new Event(REFERRAL_SUCCESS_EVENT));
        });

        expect(
            container.querySelector(".frak-banner--referral")
        ).not.toBeNull();
        expect(container.querySelector(".frak-banner--pending")).toBeNull();
    });

    it("prefers the prop text, then the dashboard text, then the default", () => {
        vi.mocked(usePlacementHook.usePlacement).mockReturnValue({
            components: {
                banner: {
                    pendingTitle: "Dashboard {REWARD}",
                    pendingDescription: "Dashboard {DAYS} days",
                },
            },
        });

        const { container } = render(
            <Banner placement="hero" pendingTitle="Prop {REWARD}" />
        );

        expect(
            container.querySelector(".frak-banner__title")
        ).toHaveTextContent("Prop 12.5 eur");
        expect(
            container.querySelector(".frak-banner__description")
        ).toHaveTextContent("Dashboard 4 days");
        expect(container.querySelector(".frak-banner__cta")).toHaveTextContent(
            "Claim my 12.5 eur"
        );
    });

    it("renders sample data in preview without tracking or fetching", () => {
        serveSummary(null);

        const { container } = render(
            <Banner preview="true" previewMode="pending" />
        );

        expect(container.querySelector(".frak-banner--pending")).not.toBeNull();
        const cta = container.querySelector(".frak-banner__cta");
        expect(cta).toHaveAttribute("href", "#");
        expect(cta).not.toHaveAttribute("target");
        expect(getInstallUrl).not.toHaveBeenCalled();
        expect(coreSdk.trackEvent).not.toHaveBeenCalled();
        expect(hasInlineReminder()).toBe(false);
    });

    it("claims through the install link and reports it", async () => {
        render(<Banner placement="hero" />);

        const cta = await screen.findByRole("link", { name: /Claim my/ });
        await waitFor(() => expect(cta).toHaveAttribute("href", INSTALL_URL));
        fireEvent.click(cta);

        expect(trackedEvents("banner_resolved")).toContainEqual({
            placement: "hero",
            variant: "pending",
            outcome: "clicked",
        });
        expect(trackedEvents("reward_reminder_claim_clicked")).toContainEqual({
            surface: "banner",
            placement: "hero",
            days_left: 4,
            locked: false,
        });
    });

    it("neither navigates nor reports a click while the install link is missing", async () => {
        vi.mocked(getInstallUrl).mockResolvedValue(undefined);
        render(<Banner placement="hero" />);
        await waitFor(() => expect(getInstallUrl).toHaveBeenCalled());

        const proceeded = fireEvent.click(
            await screen.findByRole("link", { name: /Claim my/ })
        );

        expect(proceeded).toBe(false);
        expect(trackedEvents("banner_resolved")).toEqual([]);
        expect(trackedEvents("reward_reminder_claim_clicked")).toEqual([]);
    });

    it("dismisses for the session and reports it", () => {
        const { container } = render(<Banner placement="hero" />);

        fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

        expect(container.querySelector(".frak-banner")).toBeNull();
        expect(
            sessionStorage.getItem("frak-reward-reminder-dismissed-merchant-1")
        ).toBe("1");
        expect(trackedEvents("banner_resolved")).toContainEqual({
            placement: "hero",
            variant: "pending",
            outcome: "dismissed",
        });
        expect(trackedEvents("reward_reminder_dismissed")).toHaveLength(1);
    });

    it("reports one banner and one reminder impression", () => {
        const { rerender } = render(<Banner placement="hero" />);
        rerender(<Banner placement="hero" />);

        expect(trackedEvents("banner_impression")).toEqual([
            { placement: "hero", variant: "pending", has_reward: undefined },
        ]);
        expect(trackedEvents("reward_reminder_impression")).toEqual([
            {
                surface: "banner",
                placement: "hero",
                days_left: 4,
                locked: false,
            },
        ]);
    });

    it("keeps the floating pill away while it is on screen", () => {
        const { unmount } = render(<Banner />);
        expect(hasInlineReminder()).toBe(true);

        unmount();
        expect(hasInlineReminder()).toBe(false);
    });
});
