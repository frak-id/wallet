import type { FiatAmounts, RewardSummary } from "@frak-labs/core-sdk";
import * as actions from "@frak-labs/core-sdk/actions";
import {
    act,
    fireEvent,
    render,
    screen,
    waitFor,
} from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as sharingPageUtils from "@/actions/sharingPage";
import { PostPurchase, resolveShareBaseUrl } from "./PostPurchase";

vi.mock("@/hooks/useClientReady", () => ({
    useClientReady: vi.fn(() => ({
        shouldRender: true,
        isHidden: false,
        isClientReady: true,
    })),
}));

vi.mock("@/hooks/usePlacement", () => ({
    usePlacement: vi.fn(() => undefined),
}));
vi.mock("@/hooks/useLang", () => ({ useLang: vi.fn(() => "en") }));
vi.mock("@/hooks/useGlobalComponents", () => ({
    useGlobalComponents: vi.fn(() => undefined),
}));
vi.mock("@/hooks/useLightDomStyles", () => ({ useLightDomStyles: vi.fn() }));

const trackEvent = vi.fn();
vi.mock("@frak-labs/core-sdk", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@frak-labs/core-sdk")>()),
    trackEvent: (...args: unknown[]) => trackEvent(...args),
}));

const rewardSummaryState = vi.fn<
    () => {
        status: "idle" | "loading" | "ready";
        summary: RewardSummary | null;
    }
>(() => ({ status: "ready", summary: null }));
vi.mock("@/hooks/useRewardSummary", () => ({
    useRewardSummary: () => rewardSummaryState(),
}));

vi.mock("@/actions/sharingPage", () => ({ openSharingPage: vi.fn() }));

vi.mock("@frak-labs/core-sdk/actions", () => ({
    getMerchantInformation: vi.fn(async () => ({
        id: "0x1234",
        onChainMetadata: { name: "Acme", domain: "acme.example" },
        rewards: [
            {
                token: "0x1234567890123456789012345678901234567890",
                campaignId: "campaign-1",
                name: "Campaign 1",
                interactionTypeKey: "purchase",
                referrer: {
                    payoutType: "fixed",
                    amount: {
                        amount: 10,
                        eurAmount: 1,
                        usdAmount: 1.2,
                        gbpAmount: 0.9,
                    },
                },
                conditions: [],
            },
        ],
    })),
    getInstallUrl: vi.fn(async () => "https://wallet.example/i?m=m1#p=proof"),
    getUserReferralStatus: vi.fn(async () => null),
    trackPurchaseStatus: vi.fn(async () => undefined),
}));

describe("resolveShareBaseUrl", () => {
    it.each([
        ["bare host", "shop.example.com", "https://shop.example.com/"],
        [
            "bare host with path",
            "shop.example.com/a",
            "https://shop.example.com/a",
        ],
        ["www-stripped domain", "acme.example", "https://acme.example/"],
    ])("schemes a %s", (_label, input, expected) => {
        expect(resolveShareBaseUrl(input)).toBe(expected);
    });

    it.each([
        ["https", "https://shop.example.com/shoes"],
        ["http", "http://shop.example.com/shoes"],
    ])("leaves an already-qualified %s URL usable", (_label, input) => {
        expect(resolveShareBaseUrl(input)).toBe(input);
    });

    it.each([
        ["undefined", undefined],
        ["empty string (WordPress shortcode default)", ""],
        ["whitespace", "   "],
    ])("returns undefined for %s", (_label, input) => {
        expect(resolveShareBaseUrl(input)).toBeUndefined();
    });
});

// Sequential: these tests mutate `window.FrakSetup` and shared mock state.
describe("PostPurchase sharing hand-off", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        rewardSummaryState.mockReturnValue({ status: "ready", summary: null });
        window.FrakSetup = { client: { config: { metadata: {} } } } as never;
    });

    it("forwards the order token so the sharing page can derive an identity", async () => {
        render(
            <PostPurchase
                customerId="cust-1"
                orderId="order-1"
                token="checkout-token-1"
                sharingUrl="https://acme.example/shoes"
            />
        );

        const button = await screen.findByRole("button");
        fireEvent.click(button);

        await waitFor(() => {
            expect(sharingPageUtils.openSharingPage).toHaveBeenCalledWith(
                "post_purchase",
                undefined,
                undefined,
                expect.objectContaining({ checkoutToken: "checkout-token-1" })
            );
        });
    });

    it("schemes the bare merchant domain before it reaches the sharing page", async () => {
        // `onChainMetadata.domain` is a bare host; unqualified it throws
        // `TypeError: Invalid URL` inside `FrakContextManager.update`.
        render(<PostPurchase />);

        const button = await screen.findByRole("button");
        fireEvent.click(button);

        await waitFor(() => {
            expect(sharingPageUtils.openSharingPage).toHaveBeenCalledWith(
                "post_purchase",
                undefined,
                undefined,
                expect.objectContaining({ link: "https://acme.example/" })
            );
        });
    });

    it("passes no link when the merchant-supplied sharing URL is unusable", async () => {
        // An unusable `sharing-url` must degrade to no link, never to a value
        // that throws downstream in `FrakContextManager.update`.
        render(<PostPurchase sharingUrl="   " />);

        const button = await screen.findByRole("button");
        fireEvent.click(button);

        await waitFor(() => {
            expect(sharingPageUtils.openSharingPage).toHaveBeenCalledWith(
                "post_purchase",
                undefined,
                undefined,
                expect.objectContaining({ link: undefined })
            );
        });
    });

    it("passes no token when the surface holds none", async () => {
        render(<PostPurchase sharingUrl="https://acme.example/shoes" />);

        const button = await screen.findByRole("button");
        fireEvent.click(button);

        await waitFor(() => {
            expect(sharingPageUtils.openSharingPage).toHaveBeenCalledWith(
                "post_purchase",
                undefined,
                undefined,
                {
                    link: "https://acme.example/shoes",
                    products: undefined,
                    checkoutToken: undefined,
                }
            );
        });
    });
});

const amounts = (eur: number): FiatAmounts => ({
    eurAmount: eur,
    usdAmount: eur,
    gbpAmount: eur,
});

const UNLINKED_WITH_PENDING: RewardSummary = {
    linked: false,
    earned: null,
    pending: {
        total: amounts(12),
        cashback: amounts(12),
        fromFriends: amounts(0),
        count: 1,
        lockedCount: 1,
        nextUnlockAt: null,
        expiresAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    },
};

describe("PostPurchase referee claim", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        rewardSummaryState.mockReturnValue({ status: "ready", summary: null });
        window.FrakSetup = { client: { config: { metadata: {} } } } as never;
    });

    it("offers Claim and Share to a referee whose wallet is not linked", async () => {
        render(<PostPurchase variant="referee" token="tok-1" />);

        const claim = await screen.findByRole("link", { name: /claim/i });
        await waitFor(() =>
            expect(claim).toHaveAttribute(
                "href",
                "https://wallet.example/i?m=m1#p=proof"
            )
        );
        expect(actions.getInstallUrl).toHaveBeenCalledWith({
            merchantId: undefined,
            checkoutToken: "tok-1",
        });
        expect(screen.getByRole("button")).toHaveTextContent(/share/i);
        expect(claim.className).not.toContain("secondary");
    });

    it("shows only Share once the wallet is linked", async () => {
        rewardSummaryState.mockReturnValue({
            status: "ready",
            summary: { linked: true, earned: null, pending: null },
        });
        render(<PostPurchase variant="referee" />);

        await screen.findByRole("button");
        expect(screen.queryByRole("link")).toBeNull();
    });

    it("neither navigates nor reports a claim click while the install link is missing", async () => {
        vi.mocked(actions.getInstallUrl).mockResolvedValueOnce(undefined);
        rewardSummaryState.mockReturnValue({
            status: "ready",
            summary: UNLINKED_WITH_PENDING,
        });
        render(<PostPurchase variant="referee" />);
        const claim = await screen.findByRole("link", { name: /claim/i });
        await waitFor(() => expect(actions.getInstallUrl).toHaveBeenCalled());

        const proceeded = fireEvent.click(claim);

        expect(proceeded).toBe(false);
        expect(trackEvent).not.toHaveBeenCalledWith(
            expect.anything(),
            "post_purchase_clicked",
            expect.objectContaining({ action: "claim" })
        );
    });

    it("skips the reminder impression when no reward is known to claim", async () => {
        render(<PostPurchase variant="referee" />);

        await screen.findByRole("link", { name: /claim/i });
        await waitFor(() =>
            expect(trackEvent).toHaveBeenCalledWith(
                expect.anything(),
                "post_purchase_impression",
                expect.anything()
            )
        );
        expect(trackEvent).not.toHaveBeenCalledWith(
            expect.anything(),
            "reward_reminder_impression",
            expect.anything()
        );
    });

    it("keeps the referee card back until the summary settles", async () => {
        rewardSummaryState.mockReturnValue({
            status: "loading",
            summary: null,
        });
        const { container, rerender } = render(
            <PostPurchase variant="referee" />
        );
        await waitFor(() =>
            expect(actions.getMerchantInformation).toHaveBeenCalled()
        );
        expect(container.querySelector("button")).toBeNull();

        rewardSummaryState.mockReturnValue({ status: "ready", summary: null });
        rerender(<PostPurchase variant="referee" />);
        await screen.findByRole("link", { name: /claim/i });
    });

    describe("when the summary never settles", () => {
        beforeEach(() => {
            vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
            rewardSummaryState.mockReturnValue({
                status: "loading",
                summary: null,
            });
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it("shows the card with Claim after 1.5 seconds", async () => {
            const { container } = render(<PostPurchase variant="referee" />);
            await vi.waitFor(() =>
                expect(actions.getMerchantInformation).toHaveBeenCalled()
            );
            expect(container.querySelector("button")).toBeNull();

            await act(async () => {
                await vi.advanceTimersByTimeAsync(1500);
            });

            expect(
                await screen.findByRole("link", { name: /claim/i })
            ).toBeDefined();
        });

        it("reports no impression while the card is held back", async () => {
            render(<PostPurchase variant="referee" />);
            await vi.waitFor(() =>
                expect(actions.getMerchantInformation).toHaveBeenCalled()
            );
            await act(async () => {
                await vi.advanceTimersByTimeAsync(1000);
            });
            expect(trackEvent).not.toHaveBeenCalledWith(
                expect.anything(),
                "post_purchase_impression",
                expect.anything()
            );

            await act(async () => {
                await vi.advanceTimersByTimeAsync(500);
            });
            expect(trackEvent).toHaveBeenCalledWith(
                expect.anything(),
                "post_purchase_impression",
                expect.anything()
            );
        });
    });

    it("never claims for a referrer", async () => {
        render(<PostPurchase variant="referrer" />);

        await screen.findByRole("button");
        expect(screen.queryByRole("link")).toBeNull();
    });

    it("names the real pending total on the claim button", async () => {
        rewardSummaryState.mockReturnValue({
            status: "ready",
            summary: UNLINKED_WITH_PENDING,
        });
        render(<PostPurchase variant="referee" />);

        const claim = await screen.findByRole("link", { name: /claim/i });
        expect(claim).toHaveTextContent(/^Claim my .*12/);
    });

    it("lets the claimCtaText attribute win", async () => {
        render(<PostPurchase variant="referee" claimCtaText="Get it now" />);

        expect(await screen.findByRole("link")).toHaveTextContent("Get it now");
    });

    it("reports the impression once, then claim and share separately", async () => {
        rewardSummaryState.mockReturnValue({
            status: "ready",
            summary: UNLINKED_WITH_PENDING,
        });
        render(<PostPurchase variant="referee" placement="thanks" />);

        const claim = await screen.findByRole("link", { name: /claim/i });
        await waitFor(() =>
            expect(claim).toHaveAttribute(
                "href",
                "https://wallet.example/i?m=m1#p=proof"
            )
        );
        await waitFor(() =>
            expect(trackEvent).toHaveBeenCalledWith(
                expect.anything(),
                "reward_reminder_impression",
                expect.objectContaining({
                    surface: "post_purchase",
                    locked: true,
                    days_left: expect.any(Number),
                })
            )
        );

        fireEvent.click(claim);
        expect(trackEvent).toHaveBeenCalledWith(
            expect.anything(),
            "post_purchase_clicked",
            { placement: "thanks", variant: "referee", action: "claim" }
        );
        expect(trackEvent).toHaveBeenCalledWith(
            expect.anything(),
            "reward_reminder_claim_clicked",
            expect.objectContaining({ surface: "post_purchase" })
        );

        fireEvent.click(screen.getByRole("button"));
        expect(trackEvent).toHaveBeenCalledWith(
            expect.anything(),
            "post_purchase_clicked",
            { placement: "thanks", variant: "referee", action: "share" }
        );
        expect(
            trackEvent.mock.calls.filter(
                ([, name]) => name === "reward_reminder_impression"
            )
        ).toHaveLength(1);
    });

    it("previews both buttons for the referee variant, with no network call", async () => {
        render(<PostPurchase preview="true" previewVariant="referee" />);

        expect(await screen.findByRole("link")).toHaveTextContent(
            "Claim my cashback"
        );
        expect(screen.getByRole("button")).toBeDefined();
        expect(actions.getInstallUrl).not.toHaveBeenCalled();
    });
});
