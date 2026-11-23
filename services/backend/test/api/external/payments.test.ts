import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { notifyStripeCheckout, notifyShopifyPurchase } = vi.hoisted(() => ({
    notifyStripeCheckout: vi.fn(),
    notifyShopifyPurchase: vi.fn(),
}));

vi.mock("@backend-infrastructure", () => ({
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("../../../src/orchestration/context", () => ({
    OrchestrationContext: {
        orchestrators: {
            paymentNotification: {
                notifyStripeCheckout,
                notifyShopifyPurchase,
            },
        },
    },
}));

import { paymentWebhookRoutes } from "../../../src/api/external/payments";

const STRIPE_SECRET = "whsec_test";
const SHOPIFY_SECRET = "shopify-app-secret";

const now = () => Math.floor(Date.now() / 1000).toString();
const hmac = (secret: string, timestamp: string, body: string) =>
    createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");

function stripeEvent(type: string, paymentStatus = "paid") {
    return JSON.stringify({
        id: "evt_1",
        type,
        created: 1_800_000_000,
        livemode: true,
        data: { object: { id: "cs_1", payment_status: paymentStatus } },
    });
}

function postStripe(body: string, signature?: string) {
    const timestamp = now();
    return paymentWebhookRoutes.handle(
        new Request("http://localhost/payments/stripe/webhook", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "stripe-signature":
                    signature ??
                    `t=${timestamp},v1=${hmac(STRIPE_SECRET, timestamp, body)}`,
            },
            body,
        })
    );
}

const purchase = {
    purchaseId: 42,
    shop: "acme.myshopify.com",
    domain: "acme.com",
    amount: "250",
    currency: "eur",
    bank: "0x3333333333333333333333333333333333333333",
    paidAt: "2026-11-20T10:00:00.000Z",
    test: false,
    shopName: "Acme",
    email: "owner@acme.com",
};

function postShopify(body: string, secret = SHOPIFY_SECRET) {
    const timestamp = now();
    return paymentWebhookRoutes.handle(
        new Request("http://localhost/payments/shopify/purchase", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-frak-timestamp": timestamp,
                "x-frak-signature": hmac(secret, timestamp, body),
            },
            body,
        })
    );
}

describe("Payment webhooks", () => {
    beforeEach(() => {
        vi.stubEnv("STRIPE_WEBHOOK_SECRET", STRIPE_SECRET);
        vi.stubEnv("SHOPIFY_API_SECRET", SHOPIFY_SECRET);
        notifyStripeCheckout.mockReset();
        notifyShopifyPurchase.mockReset();
    });
    afterEach(() => vi.unstubAllEnvs());

    describe("Stripe", () => {
        it.each([
            ["a paid checkout", "checkout.session.completed", "paid"],
            [
                "a delayed payment that succeeded",
                "checkout.session.async_payment_succeeded",
                "paid",
            ],
        ])("notifies %s", async (_name, type, paymentStatus) => {
            const response = await postStripe(stripeEvent(type, paymentStatus));

            expect(response.status).toBe(200);
            expect(notifyStripeCheckout).toHaveBeenCalledWith(
                expect.objectContaining({ id: "cs_1" }),
                expect.objectContaining({ id: "evt_1", livemode: true })
            );
        });

        it.each([
            [
                "a checkout still waiting on its payment",
                "checkout.session.completed",
                "unpaid",
            ],
            ["an unrelated event", "customer.created", "paid"],
        ])(
            "acknowledges %s without notifying",
            async (_name, type, paymentStatus) => {
                const response = await postStripe(
                    stripeEvent(type, paymentStatus)
                );

                expect(response.status).toBe(200);
                expect(notifyStripeCheckout).not.toHaveBeenCalled();
            }
        );

        it("answers 400 to a bad signature", async () => {
            const response = await postStripe(
                stripeEvent("checkout.session.completed"),
                `t=${now()},v1=deadbeef`
            );

            expect(response.status).toBe(400);
            expect(notifyStripeCheckout).not.toHaveBeenCalled();
        });

        it("answers 404 while no signing secret is configured", async () => {
            vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");

            const response = await postStripe(
                stripeEvent("checkout.session.completed")
            );

            expect(response.status).toBe(404);
        });
    });

    describe("Shopify", () => {
        it("notifies a purchase signed with the app secret", async () => {
            const response = await postShopify(JSON.stringify(purchase));

            expect(response.status).toBe(200);
            expect(notifyShopifyPurchase).toHaveBeenCalledWith(purchase);
        });

        it("answers 401 to a signature made with another secret", async () => {
            const response = await postShopify(
                JSON.stringify(purchase),
                "other-secret"
            );

            expect(response.status).toBe(401);
            expect(notifyShopifyPurchase).not.toHaveBeenCalled();
        });

        it("answers 400 to a signed body missing a field", async () => {
            const { bank: _bank, ...withoutBank } = purchase;

            const response = await postShopify(JSON.stringify(withoutBank));

            expect(response.status).toBe(400);
            expect(notifyShopifyPurchase).not.toHaveBeenCalled();
        });

        it("answers 400 to a signed body with a mistyped field", async () => {
            const response = await postShopify(
                JSON.stringify({ ...purchase, purchaseId: "42" })
            );

            expect(response.status).toBe(400);
            expect(notifyShopifyPurchase).not.toHaveBeenCalled();
        });

        it("accepts a field from a newer Shopify app", async () => {
            const newer = { ...purchase, plan: "plus" };

            const response = await postShopify(JSON.stringify(newer));

            expect(response.status).toBe(200);
            expect(notifyShopifyPurchase).toHaveBeenCalledWith(newer);
        });
    });
});
