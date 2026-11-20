import { describe, expect, it, vi } from "vitest";
import { DnsCheckRepository } from "../infrastructure/dns/DnsCheckRepository";
import type { StripeCheckoutSession } from "../infrastructure/integrations/stripe";
import { PaymentNotificationOrchestrator } from "./PaymentNotificationOrchestrator";
import type { ShopifyPaidPurchase } from "./schemas/paymentSchemas";

vi.mock("@backend-infrastructure", () => ({
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const MERCHANT_ID = "0b5a1c39-7a3e-4b8e-9d3c-2f1f6e8a9b10";
const merchant = {
    id: MERCHANT_ID,
    name: "Acme",
    domain: "acme.com",
    bankAddress: "0x2222222222222222222222222222222222222222",
};

function setup() {
    const merchants = {
        findById: vi.fn().mockResolvedValue(merchant),
        findByDomain: vi.fn().mockResolvedValue(null),
        findByAllowedDomain: vi.fn().mockResolvedValue(null),
    };
    const slack = { postMessage: vi.fn().mockResolvedValue(true) };
    const orchestrator = new PaymentNotificationOrchestrator(
        merchants as never,
        new DnsCheckRepository(),
        slack as never
    );
    const posted = () =>
        slack.postMessage.mock.calls.map(([message]) =>
            JSON.stringify(message)
        );
    return { orchestrator, merchants, slack, posted };
}

const session: StripeCheckoutSession = {
    id: "cs_1",
    amount_total: 50_000,
    currency: "eur",
    payment_status: "paid",
    payment_intent: "pi_1",
    client_reference_id: MERCHANT_ID,
    customer_details: { email: "jane@acme.com", name: "Jane" },
};
const event = { created: 1_800_000_000, livemode: true };

const purchase: ShopifyPaidPurchase = {
    purchaseId: 42,
    shop: "acme.myshopify.com",
    domain: "www.acme.com",
    amount: "250",
    currency: "eur",
    bank: "0x3333333333333333333333333333333333333333",
    paidAt: "2026-11-20T10:00:00.000Z",
    test: false,
    shopName: "Acme",
    email: "owner@acme.com",
};

describe("PaymentNotificationOrchestrator.notifyStripeCheckout", () => {
    it("names the merchant from client_reference_id and links the payment", async () => {
        const { orchestrator, merchants, slack, posted } = setup();

        await orchestrator.notifyStripeCheckout(session, event);

        expect(merchants.findById).toHaveBeenCalledWith(MERCHANT_ID);
        expect(slack.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({ channel: "payments" })
        );
        const [message] = posted();
        expect(message).toContain("€500.00 paid via Stripe from Acme");
        expect(message).toContain("jane@acme.com");
        expect(message).toContain(merchant.bankAddress);
        expect(message).toContain("https://dashboard.stripe.com/payments/pi_1");
    });

    it("posts once when Stripe delivers the same session twice", async () => {
        const { orchestrator, slack } = setup();

        await orchestrator.notifyStripeCheckout(session, event);
        await orchestrator.notifyStripeCheckout(session, event);

        expect(slack.postMessage).toHaveBeenCalledTimes(1);
    });

    it("skips the lookup for a reference that is not a merchant id", async () => {
        const { orchestrator, merchants, posted } = setup();

        await orchestrator.notifyStripeCheckout(
            { ...session, client_reference_id: "manual-invoice" },
            event
        );

        expect(merchants.findById).not.toHaveBeenCalled();
        expect(posted()[0]).toContain("_Not found_ (ref `manual-invoice`)");
    });

    it("still posts when the merchant lookup fails", async () => {
        const { orchestrator, merchants, slack } = setup();
        merchants.findById.mockRejectedValue(new Error("db down"));

        await orchestrator.notifyStripeCheckout(session, event);

        expect(slack.postMessage).toHaveBeenCalledTimes(1);
    });
});

describe("PaymentNotificationOrchestrator.notifyShopifyPurchase", () => {
    it("falls back to the myshopify domain to find the merchant", async () => {
        const { orchestrator, merchants, posted } = setup();
        merchants.findByDomain.mockImplementation(async (domain: string) =>
            domain === "acme.myshopify.com" ? merchant : null
        );

        await orchestrator.notifyShopifyPurchase(purchase);

        expect(merchants.findByDomain.mock.calls).toEqual([
            ["acme.com"],
            ["acme.myshopify.com"],
        ]);
        const [message] = posted();
        expect(message).toContain("€250.00 paid via Shopify from Acme");
        expect(message).toContain("Acme (acme.myshopify.com)");
        expect(message).toContain("owner@acme.com");
        expect(message).toContain(purchase.bank);
        expect(message).toContain("AppPurchaseOneTime 42");
    });

    it("normalizes the shop domain the way merchant domains are stored", async () => {
        const { orchestrator, merchants, posted } = setup();
        merchants.findByDomain.mockImplementation(async (domain: string) =>
            domain === "acme.com" ? merchant : null
        );

        await orchestrator.notifyShopifyPurchase({
            ...purchase,
            domain: "https://WWW.Acme.com/",
        });

        expect(merchants.findByDomain).toHaveBeenCalledTimes(1);
        expect(posted()[0]).toContain("€250.00 paid via Shopify from Acme");
    });
});
