import { log } from "@backend-infrastructure";
import { t, validateBodyHmac } from "@backend-utils";
import { Elysia } from "elysia";
import type { purchaseStatusEnum } from "../../../../domain/purchases";
import type {
    WooCommerceOrderStatus,
    WooCommerceOrderUpdateWebhookDto,
} from "../../../../domain/purchases/dto/WooCommerceWebhook";
import { OrchestrationContext } from "../../../../orchestration/context";

export const wooCommerceWebhook = new Elysia()
    .guard({
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
            identifier: t.Optional(t.String()),
        }),
    })
    .onBeforeHandle(({ headers }) => {
        if (!headers["x-wc-webhook-signature"]) {
            throw new Error("Missing signature");
        }
        if (headers["x-wc-webhook-resource"] !== "order") {
            throw new Error("Unsupported woo commerce webhook");
        }
    })
    .post(
        "/woocommerce",
        async ({ params: { identifier }, body, headers }) => {
            const webhookData = JSON.parse(
                body
            ) as WooCommerceOrderUpdateWebhookDto;

            if (!identifier) {
                throw new Error("Missing merchant identifier");
            }

            const resolved =
                await OrchestrationContext.orchestrators.webhookResolver.resolveWebhook(
                    identifier
                );
            if (!resolved) {
                log.warn({ identifier }, "Webhook not found");
                throw new Error("Webhook not found");
            }

            const { webhook, merchantId } = resolved;

            validateBodyHmac({
                body,
                secret: webhook.hookSignatureKey,
                signature: headers["x-wc-webhook-signature"],
            });

            const purchaseStatus = mapOrderStatus(webhookData.status);

            await OrchestrationContext.orchestrators.purchaseWebhook.upsertPurchase(
                {
                    purchase: {
                        webhookId: webhook.id,
                        externalId: webhookData.id.toString(),
                        externalCustomerId: webhookData.customer_id.toString(),
                        purchaseToken:
                            webhookData.order_key ?? webhookData.transaction_id,
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
                        imageUrl: item.image?.src?.length
                            ? item.image.src
                            : null,
                    })),
                    merchantId,
                }
            );

            return "ok";
        },
        {
            parse: "text",
            body: t.String(),
            params: t.Object({
                identifier: t.Optional(t.String()),
            }),
        }
    );

function mapOrderStatus(
    orderStatus: WooCommerceOrderStatus
): (typeof purchaseStatusEnum.enumValues)[number] {
    if (orderStatus === "completed") {
        return "confirmed";
    }
    if (orderStatus === "refunded") {
        return "refunded";
    }
    if (orderStatus === "cancelled") {
        return "cancelled";
    }

    return "pending";
}
