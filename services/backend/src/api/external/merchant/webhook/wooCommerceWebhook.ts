import { log } from "@backend-infrastructure";
import { t, validateBodyHmac } from "@backend-utils";
import { Elysia } from "elysia";
import type { PurchaseStatus } from "../../../../domain/purchases";
import type { WooCommerceOrderUpdateWebhookDto } from "../../../../domain/purchases/dto/WooCommerceWebhook";
import { OrchestrationContext } from "../../../../orchestration/context";

export const wooCommerceWebhook = new Elysia().post(
    "/woocommerce",
    async ({ params: { merchantId }, body, headers }) => {
        // WooCommerce sends a test "ping" to the delivery URL the first
        // time a webhook is saved with status=active, or whenever the URL
        // changes (see `WC_Webhook::deliver_ping()` in woocommerce/woocommerce).
        // The ping is unsigned, has no `x-wc-webhook-*` headers, and carries
        // a form-encoded body `webhook_id=N`. We acknowledge it with a 200
        // so `pending_delivery` flips to false on the WC side and the
        // operator sees the webhook as healthy in the WC admin UI.
        const signature = headers["x-wc-webhook-signature"];
        if (!signature) {
            if (typeof body === "string" && body.startsWith("webhook_id=")) {
                log.info({ merchantId }, "WC webhook ping acknowledged");
                return "ok";
            }
            throw new Error("Missing signature");
        }
        if (headers["x-wc-webhook-resource"] !== "order") {
            throw new Error("Unsupported woo commerce webhook");
        }

        const webhookData = JSON.parse(
            body
        ) as WooCommerceOrderUpdateWebhookDto;

        if (!merchantId) {
            throw new Error("Missing merchant identifier");
        }

        const resolved =
            await OrchestrationContext.orchestrators.webhookResolver.resolveWebhook(
                merchantId
            );
        if (!resolved) {
            log.warn({ merchantId }, "Webhook not found");
            throw new Error("Webhook not found");
        }

        validateBodyHmac({
            body,
            secret: resolved.webhook.hookSignatureKey,
            signature,
        });

        const purchaseStatus = mapOrderStatus(webhookData);

        await OrchestrationContext.orchestrators.purchaseWebhook.upsertPurchase(
            {
                purchase: {
                    webhookId: resolved.webhook.id,
                    externalId: webhookData.id.toString(),
                    externalCustomerId: webhookData.customer_id.toString(),
                    purchaseToken: buildPurchaseToken(webhookData),
                    status: purchaseStatus,
                    totalPrice: webhookData.total,
                    currencyCode: webhookData.currency,
                },
                purchaseItems: webhookData.line_items.map((item) => ({
                    externalId: item.product_id.toString(),
                    price: item.price.toString(),
                    name: item.name,
                    title: item.name,
                    quantity: item.quantity,
                    imageUrl: item.image?.src?.length ? item.image.src : null,
                })),
                merchantId: resolved.merchantId,
            }
        );

        return "ok";
    },
    {
        parse: "text",
        body: t.String(),
        headers: t.Partial(
            t.Object({
                "x-wc-webhook-source": t.String(),
                "x-wc-webhook-topic": t.String(),
                "x-wc-webhook-resource": t.String(),
                "x-wc-webhook-event": t.String(),
                "x-wc-webhook-signature": t.String(),
                "x-wc-webhook-id": t.String(),
                "x-wc-webhook-delivery-id": t.String(),
            })
        ),
        params: t.Object({
            merchantId: t.Optional(t.String()),
        }),
    }
);

/**
 * Build the canonical purchase token used as the secondary index on the
 * purchases table.
 *
 * We combine `order_key` with `id` because WooCommerce's `order_key` is not
 * guaranteed unique across a store's history — plugins that clone/import
 * orders (CSV importers, subscription renewals, manual admin duplication)
 * can reuse a key since the `_order_key` post meta has no DB-level UNIQUE
 * constraint. Appending the auto-increment order id neutralizes that risk
 * and matches the token the plugin's frontend sends on the thank-you page.
 *
 * The frontend mirror lives in the WP plugin at:
 *   plugins/wordpress/includes/class-frak-woocommerce.php (`render_purchase_tracker_for_order`)
 */
function buildPurchaseToken(
    webhookData: WooCommerceOrderUpdateWebhookDto
): string {
    if (webhookData.order_key) {
        return `${webhookData.order_key}_${webhookData.id}`;
    }
    return webhookData.transaction_id || webhookData.id.toString();
}

/**
 * Translate a WooCommerce order payload into our internal purchase status.
 *
 * Partial refunds do not flip WooCommerce's order status to `refunded`: the
 * order stays `completed`/`processing` and only the `refunds[]` array grows
 * (see `woocommerce/includes/class-wc-order-refund.php`). We treat any
 * non-empty `refunds[]` as `refunded` so attribution is voided at the first
 * partial refund — matches Shopify's behavior and keeps the reward side
 * conservative.
 */
function mapOrderStatus(
    webhookData: WooCommerceOrderUpdateWebhookDto
): PurchaseStatus {
    if (webhookData.refunds && webhookData.refunds.length > 0) {
        return "refunded";
    }
    const orderStatus = webhookData.status;
    if (orderStatus === "completed") {
        return "confirmed";
    }
    if (orderStatus === "refunded") {
        return "refunded";
    }
    if (orderStatus === "cancelled" || orderStatus === "failed") {
        return "cancelled";
    }

    return "pending";
}
