import { log } from "@backend-infrastructure";
import { t, verifyTimestampedBody } from "@backend-utils";
import { Elysia, status } from "elysia";
import {
    isValidStripeSignature,
    type StripeCheckoutSession,
    type StripeEvent,
} from "../../infrastructure/integrations/stripe";
import { OrchestrationContext } from "../../orchestration/context";
import type { ShopifyPaidPurchase } from "../../orchestration/PaymentNotificationOrchestrator";

const textResponses = {
    200: t.String(),
    400: t.String(),
    401: t.String(),
    404: t.String(),
};

/** Delayed methods (SEPA, bank transfer) complete unpaid, then succeed in a second event. */
function paidCheckoutSession(event: StripeEvent): StripeCheckoutSession | null {
    // Signed by Stripe, so the object has the documented Checkout Session shape.
    const session = event.data.object as StripeCheckoutSession;
    if (event.type === "checkout.session.async_payment_succeeded") {
        return session;
    }
    if (
        event.type === "checkout.session.completed" &&
        session.payment_status === "paid"
    ) {
        return session;
    }
    return null;
}

const SHOPIFY_STRING_FIELDS = [
    "shop",
    "domain",
    "amount",
    "currency",
    "bank",
    "paidAt",
] as const;

function parseShopifyPurchase(body: string): ShopifyPaidPurchase | null {
    let value: Record<string, unknown>;
    try {
        value = JSON.parse(body);
    } catch {
        return null;
    }
    const valid =
        typeof value?.purchaseId === "number" &&
        typeof value.test === "boolean" &&
        SHOPIFY_STRING_FIELDS.every((key) => typeof value[key] === "string");
    // Every required field was type-checked just above.
    return valid ? (value as ShopifyPaidPurchase) : null;
}

/**
 * Merchant bank top-ups, posted to Slack for ops. Both routes answer 200 once
 * authenticated, even when Slack fails, so a provider never redelivers a payment.
 */
export const paymentWebhookRoutes = new Elysia({ prefix: "/payments" })
    .post(
        "/stripe/webhook",
        async ({ body, headers }) => {
            const secret = process.env.STRIPE_WEBHOOK_SECRET;
            if (!secret) return status(404, "Not Found");
            // The raw text: Stripe signs its exact bytes.
            if (
                !isValidStripeSignature({
                    body,
                    header: headers["stripe-signature"],
                    secret,
                })
            ) {
                log.warn("Stripe webhook signature mismatch");
                return status(400, "Bad Request");
            }

            let event: StripeEvent;
            try {
                event = JSON.parse(body);
            } catch {
                return status(400, "Bad Request");
            }
            const session = paidCheckoutSession(event);
            if (session) {
                await OrchestrationContext.orchestrators.paymentNotification.notifyStripeCheckout(
                    session,
                    event
                );
            }
            return "ok";
        },
        {
            parse: "text",
            body: t.String(),
            headers: t.Object({
                "stripe-signature": t.Optional(t.String()),
            }),
            response: textResponses,
        }
    )
    .post(
        "/shopify/purchase",
        async ({ body, headers }) => {
            // Signed by apps/shopify with the Shopify app secret both services hold.
            const verified = verifyTimestampedBody({
                secret: process.env.SHOPIFY_API_SECRET ?? "",
                timestamp: headers["x-frak-timestamp"] ?? "",
                body,
                signatures: [headers["x-frak-signature"] ?? ""],
            });
            if (!verified) return status(401, "Unauthorized");

            const purchase = parseShopifyPurchase(body);
            if (!purchase) return status(400, "Bad Request");
            await OrchestrationContext.orchestrators.paymentNotification.notifyShopifyPurchase(
                purchase
            );
            return "ok";
        },
        {
            parse: "text",
            body: t.String(),
            headers: t.Object({
                "x-frak-timestamp": t.Optional(t.String()),
                "x-frak-signature": t.Optional(t.String()),
            }),
            response: textResponses,
        }
    );
