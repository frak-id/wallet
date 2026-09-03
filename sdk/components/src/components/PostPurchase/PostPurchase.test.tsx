import { fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
describe.sequential("PostPurchase sharing hand-off", () => {
    beforeEach(() => {
        vi.clearAllMocks();
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
