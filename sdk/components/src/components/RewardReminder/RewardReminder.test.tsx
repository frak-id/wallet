import * as coreSdk from "@frak-labs/core-sdk";
import { type PendingRewardSummary, sdkConfigStore } from "@frak-labs/core-sdk";
import { getInstallUrl } from "@frak-labs/core-sdk/actions";
import {
    act,
    fireEvent,
    render,
    screen,
    waitFor,
} from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as useClientReadyHook from "@/hooks/useClientReady";
import { useRewardSummary } from "@/hooks/useRewardSummary";
import { registerInlineReminder } from "@/rewards/inlineSurfaces";
import { RewardReminder } from "./RewardReminder";

vi.mock("@frak-labs/core-sdk", async () => {
    const actual = await vi.importActual<typeof import("@frak-labs/core-sdk")>(
        "@frak-labs/core-sdk"
    );
    return {
        ...actual,
        isMobile: vi.fn(() => false),
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
    return { ...actual, getInstallUrl: vi.fn() };
});

vi.mock("@/hooks/useClientReady", () => ({ useClientReady: vi.fn() }));
vi.mock("@/hooks/useRewardSummary", () => ({ useRewardSummary: vi.fn() }));
const qrState = vi.hoisted(() => ({
    wide: true,
    grid: null as boolean[][] | null,
}));

vi.mock("../Ambassador/InstallQr", () => ({
    useInstallQr: (url?: string) => ({
        wide: qrState.wide,
        grid: qrState.wide && url ? qrState.grid : null,
    }),
    QrSvg: (props: { label: string; class?: string }) => (
        <svg role="img" aria-label={props.label} class={props.class} />
    ),
}));

const inlineRegistrations: Array<() => void> = [];

function registerInline(): () => void {
    const unregister = registerInlineReminder();
    inlineRegistrations.push(unregister);
    return unregister;
}

const CHROME_UA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const SAFARI_UA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";

const INSTALL_URL = "https://wallet.test/i?m=abc#p=proof";
const DAY = 24 * 60 * 60 * 1000;

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
        expiresAt: new Date(Date.now() + 10 * DAY + 3600_000).toISOString(),
        ...overrides,
    };
}

function setStaticReminderConfig(
    rewardReminder: NonNullable<
        NonNullable<typeof window.FrakSetup.config>["rewardReminder"]
    >
): void {
    window.FrakSetup.config = { metadata: { name: "Harmo" }, rewardReminder };
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

function setBackendConfig(
    components?: NonNullable<
        ReturnType<typeof sdkConfigStore.getConfig>["components"]
    >,
    overrides: { hidden?: boolean; resolved?: boolean; name?: string } = {}
): void {
    sdkConfigStore.setConfig({
        isResolved: overrides.resolved ?? true,
        merchantId: "merchant-1",
        name: overrides.name ?? "Harmo",
        hidden: overrides.hidden,
        components,
    });
}

function setClientReady(
    state: Partial<ReturnType<typeof useClientReadyHook.useClientReady>> = {}
): void {
    vi.mocked(useClientReadyHook.useClientReady).mockReturnValue({
        shouldRender: true,
        isHidden: false,
        isClientReady: true,
        ...state,
    });
}

const pillButton = () => screen.queryByRole("button", { expanded: false });
const rootElement = (container: Element) =>
    container.querySelector(".frak-reward-reminder");

describe("RewardReminder", () => {
    const userAgent = vi.spyOn(window.navigator, "userAgent", "get");

    beforeEach(() => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date(2026, 10, 7, 12));
        userAgent.mockReturnValue(CHROME_UA);
        setClientReady();
        setBackendConfig();
        serveSummary(pendingRewards());
        vi.mocked(getInstallUrl).mockResolvedValue(INSTALL_URL);
        vi.mocked(coreSdk.isMobile).mockReturnValue(false);
        qrState.wide = true;
        qrState.grid = null;
    });

    afterEach(() => {
        vi.useRealTimers();
        for (const unregister of inlineRegistrations.splice(0)) unregister();
        sdkConfigStore.clearCache();
        window.__frakSdkConfig = undefined;
    });

    describe("visibility", () => {
        it("shows the amount and the countdown to an unlinked visitor", () => {
            render(<RewardReminder />);

            const pill = screen.getByRole("button", { expanded: false });
            expect(pill).toHaveTextContent("12.5 eur");
            expect(pill).toHaveTextContent(/days? left/);
        });

        it("draws the gift in a light stroke on the dark pill", () => {
            render(<RewardReminder />);

            const strokes = Array.from(
                pillButton()?.querySelectorAll("svg [stroke]") ?? [],
                (node) => node.getAttribute("stroke")
            );
            expect(strokes.length).toBeGreaterThan(0);
            expect(new Set(strokes)).toEqual(new Set(["#fff"]));
        });

        it.each([
            [
                "the client is not ready",
                () => setClientReady({ isClientReady: false }),
            ],
            [
                "the backend config has not rendered",
                () => setClientReady({ shouldRender: false }),
            ],
            [
                "the backend config is not resolved",
                () => setBackendConfig(undefined, { resolved: false }),
            ],
            [
                "the merchant is hidden",
                () => {
                    setClientReady({ isHidden: true });
                    setBackendConfig(undefined, { hidden: true });
                },
            ],
            [
                "the page config turns it off",
                () => {
                    setStaticReminderConfig({ enabled: false });
                },
            ],
            [
                "the dashboard turns it off",
                () => setBackendConfig({ rewardReminder: { enabled: false } }),
            ],
            [
                "the page config enables it but the dashboard disables it",
                () => {
                    setStaticReminderConfig({ enabled: true });
                    setBackendConfig({ rewardReminder: { enabled: false } });
                },
            ],
            ["nothing is pending", () => serveSummary(null)],
            [
                "the visitor is linked",
                () => serveSummary(pendingRewards(), true),
            ],
            [
                "no reward is counted",
                () => serveSummary(pendingRewards({ count: 0 })),
            ],
            [
                "an inline reminder is showing",
                () => {
                    registerInline();
                },
            ],
        ])("stays hidden when %s", (_, arrange) => {
            arrange();

            const { container } = render(<RewardReminder />);

            expect(rootElement(container)).toBeNull();
        });

        it("stays hidden once dismissed this session", () => {
            sessionStorage.setItem(
                "frak-reward-reminder-dismissed-merchant-1",
                "1"
            );

            const { container } = render(<RewardReminder />);

            expect(rootElement(container)).toBeNull();
        });

        it("renders sample data in preview without any fetch", () => {
            serveSummary(null);
            setClientReady({ isClientReady: false });

            render(<RewardReminder preview="true" />);

            expect(
                screen.getByRole("button", { expanded: false })
            ).toHaveTextContent("12.5 eur");
            fireEvent.click(screen.getByRole("button", { expanded: false }));
            const claim = screen.getByRole("link");
            expect(claim).toHaveAttribute("href", "#");
            expect(claim).not.toHaveAttribute("target");
            expect(useRewardSummary).toHaveBeenCalledWith(false);
            expect(getInstallUrl).not.toHaveBeenCalled();
            expect(coreSdk.trackEvent).not.toHaveBeenCalled();
        });

        it("only asks for the summary once the page may show it", () => {
            render(<RewardReminder />);

            expect(useRewardSummary).toHaveBeenCalledWith(true);
        });
    });

    describe("position", () => {
        const side = (container: Element) =>
            rootElement(container)?.className ?? "";

        it("defaults to the left", () => {
            const { container } = render(<RewardReminder />);

            expect(side(container)).toMatch(/sideLeft/);
        });

        it("follows the static config", () => {
            setStaticReminderConfig({ position: "right" });

            const { container } = render(<RewardReminder />);

            expect(side(container)).toMatch(/sideRight/);
        });

        it("lets the dashboard outrank the static config", () => {
            setStaticReminderConfig({ position: "right" });
            setBackendConfig({ rewardReminder: { position: "left" } });

            const { container } = render(<RewardReminder />);

            expect(side(container)).toMatch(/sideLeft/);
        });

        it("lets the attribute outrank everything", () => {
            setStaticReminderConfig({ position: "left" });
            setBackendConfig({ rewardReminder: { position: "left" } });

            const { container } = render(<RewardReminder position="right" />);

            expect(side(container)).toMatch(/sideRight/);
        });

        it("ignores an unknown attribute value", () => {
            setBackendConfig({ rewardReminder: { position: "right" } });

            const { container } = render(
                <RewardReminder position={"middle" as "left"} />
            );

            expect(side(container)).toMatch(/sideRight/);
        });
    });

    describe("card", () => {
        const open = () =>
            fireEvent.click(screen.getByRole("button", { expanded: false }));

        it("never opens by itself", () => {
            render(<RewardReminder />);

            expect(screen.queryByRole("dialog")).toBeNull();
        });

        it("opens a dialog labelled by its eyebrow and amount, with the default copy", () => {
            render(<RewardReminder />);
            open();

            const dialog = screen.getByRole("dialog", {
                name: "Waiting for you at Harmo 12.5 eur",
            });
            expect(dialog).toHaveTextContent(
                "Free with the Frak app, no bank details needed"
            );
            expect(
                screen.getByRole("button", { expanded: true })
            ).toHaveAttribute("aria-controls", dialog.id);
        });

        it("moves focus into the card, then back to the pill on Escape", () => {
            render(<RewardReminder />);
            const pill = screen.getByRole("button", { expanded: false });
            open();

            const dialog = screen.getByRole("dialog");
            expect(dialog).toHaveFocus();

            fireEvent.keyDown(dialog, { key: "Escape" });

            expect(screen.queryByRole("dialog")).toBeNull();
            expect(pill).toHaveFocus();
            expect(pill).toHaveAttribute("aria-expanded", "false");
        });

        it("closes from the close button and returns focus to the pill", () => {
            render(<RewardReminder />);
            const pill = screen.getByRole("button", { expanded: false });
            open();

            fireEvent.click(screen.getByRole("button", { name: "Close" }));

            expect(screen.queryByRole("dialog")).toBeNull();
            expect(pill).toHaveFocus();
        });

        it("collapses when the pill is pressed again", () => {
            render(<RewardReminder />);
            open();

            fireEvent.click(screen.getByRole("button", { expanded: true }));

            expect(screen.queryByRole("dialog")).toBeNull();
        });

        it("points the claim link at the prefetched install URL", async () => {
            render(<RewardReminder />);
            open();

            const claim = await screen.findByRole("link", {
                name: "Claim my 12.5 eur",
            });
            await waitFor(() =>
                expect(claim).toHaveAttribute("href", INSTALL_URL)
            );
            expect(claim).toHaveAttribute("target", "_blank");
            expect(claim).toHaveAttribute("rel", "noopener");
        });

        it("neither navigates nor reports a claim click while the install link is missing", async () => {
            vi.mocked(getInstallUrl).mockResolvedValue(undefined);
            render(<RewardReminder />);
            open();
            await waitFor(() => expect(getInstallUrl).toHaveBeenCalled());

            const proceeded = fireEvent.click(
                await screen.findByRole("link", { name: /Claim my/ })
            );

            expect(proceeded).toBe(false);
            expect(coreSdk.trackEvent).not.toHaveBeenCalledWith(
                expect.anything(),
                "reward_reminder_claim_clicked",
                expect.anything()
            );
        });

        describe("QR", () => {
            const QR_NAME = "QR code to claim your reward in the Frak wallet";
            const qrButton = () =>
                screen.queryByRole("button", { name: QR_NAME });

            beforeEach(() => {
                qrState.grid = [[true]];
            });

            it("starts small and enlarges on click, then shrinks back", async () => {
                render(<RewardReminder />);
                open();

                await waitFor(() =>
                    expect(qrButton()).toHaveAttribute("aria-expanded", "false")
                );
                expect(screen.getByRole("dialog")).toHaveTextContent(
                    "On a computer? Click to enlarge"
                );

                fireEvent.click(qrButton() as HTMLElement);
                expect(qrButton()).toHaveAttribute("aria-expanded", "true");
                expect(screen.getByRole("dialog")).toHaveTextContent(
                    "Scan with your phone to claim"
                );

                fireEvent.click(qrButton() as HTMLElement);
                expect(qrButton()).toHaveAttribute("aria-expanded", "false");
            });

            it.each([
                [
                    "on a phone",
                    () => vi.mocked(coreSdk.isMobile).mockReturnValue(true),
                ],
                [
                    "in a narrow window",
                    () => {
                        qrState.wide = false;
                    },
                ],
            ])("is left out %s", async (_, arrange) => {
                arrange();
                render(<RewardReminder />);
                open();

                await screen.findByRole("link", { name: /Claim my/ });
                expect(qrButton()).toBeNull();
                expect(
                    screen.getByRole("button", { name: "Later" })
                ).toBeInTheDocument();
            });
        });

        it("sums the breakdown up in one line only when both sources are non-zero", () => {
            const { unmount } = render(<RewardReminder />);
            open();
            expect(screen.queryByText(/cashback/)).toBeNull();
            unmount();

            serveSummary(
                pendingRewards({
                    cashback: amounts(10),
                    fromFriends: amounts(2.5),
                })
            );
            render(<RewardReminder />);
            open();
            expect(
                screen.getByText("10 eur cashback · 2.5 eur from friends")
            ).toBeInTheDocument();
        });

        it.each([
            [1, "1 day left"],
            [5, "5 days left"],
        ])("reads %i day(s) as %s on the pill", (days, label) => {
            serveSummary(
                pendingRewards({
                    expiresAt: new Date(
                        Date.now() + (days - 0.5) * DAY
                    ).toISOString(),
                })
            );

            render(<RewardReminder />);

            expect(
                screen.getByRole("button", { expanded: false })
            ).toHaveTextContent(label);
        });

        it("counts the days left in a tile and states the deadline", () => {
            render(<RewardReminder />);
            open();

            const dialog = screen.getByRole("dialog");
            expect(screen.getByText("10").parentElement).toHaveTextContent(
                "10 days left"
            );
            expect(dialog).toHaveTextContent(/Lost if not claimed by .+\./);
        });

        it("reads Last day in the tile on the expiry date", () => {
            serveSummary(
                pendingRewards({
                    expiresAt: new Date(2026, 10, 7, 18).toISOString(),
                })
            );
            render(<RewardReminder />);
            open();

            expect(screen.getByText("Last").parentElement).toHaveTextContent(
                "Last day"
            );
            expect(screen.getByRole("dialog")).toHaveTextContent(
                "Lost if not claimed today."
            );
        });

        it("stays hidden once the deadline has passed", () => {
            serveSummary(
                pendingRewards({
                    expiresAt: new Date(Date.now() - 1000).toISOString(),
                })
            );
            const { container } = render(<RewardReminder />);

            expect(rootElement(container)).toBeNull();
        });

        it("says the whole reward unlocks on the date when every reward is locked", () => {
            serveSummary(
                pendingRewards({
                    lockedCount: 1,
                    nextUnlockAt: new Date(Date.now() + 2 * DAY).toISOString(),
                })
            );
            render(<RewardReminder />);
            open();

            expect(screen.getByRole("dialog")).toHaveTextContent(/Unlocks on/);
        });

        it("notes the unlock date while part of it is locked", () => {
            serveSummary(
                pendingRewards({
                    count: 2,
                    lockedCount: 1,
                    nextUnlockAt: new Date(Date.now() + 2 * DAY).toISOString(),
                })
            );
            render(<RewardReminder />);
            open();

            expect(screen.getByRole("dialog")).toHaveTextContent(
                /Part of it unlocks on/
            );
        });

        it("prefers the attribute text, then the dashboard text", async () => {
            setBackendConfig({
                rewardReminder: {
                    title: "Dashboard {REWARD}",
                    cta: "Dashboard cta",
                },
            });
            render(<RewardReminder heading="Attribute {BRAND}" />);
            open();

            expect(
                screen.getByRole("dialog", { name: "Attribute Harmo 12.5 eur" })
            ).toBeInTheDocument();
            expect(
                await screen.findByRole("link", { name: "Dashboard cta" })
            ).toBeInTheDocument();
        });
    });

    describe("dismissal", () => {
        it("hides the pill for the session from the dismiss control", () => {
            const { container } = render(<RewardReminder />);

            fireEvent.click(
                screen.getByRole("button", { name: "Dismiss reminder" })
            );

            expect(rootElement(container)).toBeNull();
            expect(
                sessionStorage.getItem(
                    "frak-reward-reminder-dismissed-merchant-1"
                )
            ).toBe("1");
        });

        it("hides it from Later too", () => {
            const { container } = render(<RewardReminder />);
            fireEvent.click(screen.getByRole("button", { expanded: false }));

            fireEvent.click(screen.getByRole("button", { name: "Later" }));

            expect(rootElement(container)).toBeNull();
        });

        it("steps aside while an inline reminder is showing, and returns after", () => {
            const { container } = render(<RewardReminder />);
            let unregister = () => {};

            act(() => {
                unregister = registerInline();
            });
            expect(rootElement(container)).toBeNull();

            act(() => unregister());
            expect(rootElement(container)).not.toBeNull();
        });
    });

    describe("analytics", () => {
        const surfaceProps = (days: number) => ({
            surface: "pill",
            placement: "footer",
            days_left: days,
            locked: false,
        });

        it("reports one impression per mount", () => {
            const { rerender } = render(<RewardReminder placement="footer" />);
            rerender(<RewardReminder placement="footer" />);

            const impressions = vi
                .mocked(coreSdk.trackEvent)
                .mock.calls.filter(
                    ([, event]) => event === "reward_reminder_impression"
                );
            expect(impressions).toHaveLength(1);
            expect(impressions[0][2]).toEqual(surfaceProps(10));
        });

        it("reports opened, claim clicked and dismissed", async () => {
            render(<RewardReminder placement="footer" />);

            fireEvent.click(screen.getByRole("button", { expanded: false }));
            const claim = await screen.findByRole("link", {
                name: /Claim my/,
            });
            await waitFor(() =>
                expect(claim).toHaveAttribute("href", INSTALL_URL)
            );
            fireEvent.click(claim);
            fireEvent.click(
                screen.getByRole("button", { name: "Dismiss reminder" })
            );

            const calls = vi.mocked(coreSdk.trackEvent).mock.calls;
            for (const event of [
                "reward_reminder_opened",
                "reward_reminder_claim_clicked",
                "reward_reminder_dismissed",
            ] as const) {
                expect(calls).toContainEqual([
                    window.FrakSetup.client,
                    event,
                    surfaceProps(10),
                ]);
            }
        });

        it("flags locked rewards", () => {
            serveSummary(pendingRewards({ lockedCount: 1 }));

            render(<RewardReminder />);

            expect(coreSdk.trackEvent).toHaveBeenCalledWith(
                window.FrakSetup.client,
                "reward_reminder_impression",
                expect.objectContaining({ locked: true })
            );
        });

        it("does not report while hidden", () => {
            serveSummary(null);

            render(<RewardReminder />);

            expect(coreSdk.trackEvent).not.toHaveBeenCalled();
        });
    });

    it("caps the countdown at 7 days on WebKit", () => {
        userAgent.mockReturnValue(SAFARI_UA);

        render(<RewardReminder />);

        expect(
            screen.getByRole("button", { expanded: false })
        ).toHaveTextContent("7 days left");
    });

    it("keeps the pill reachable by label for assistive tech", () => {
        render(<RewardReminder />);

        expect(pillButton()).toHaveAccessibleName(
            /12\.5 eur to claim, show details, \d+ days left/
        );
    });
});
