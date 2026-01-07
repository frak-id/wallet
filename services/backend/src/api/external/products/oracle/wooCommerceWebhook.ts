import { db, log } from "@backend-infrastructure";
import { t, validateBodyHmac } from "@backend-utils";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import {
    merchantWebhooksTable,
    PurchasesContext,
    type purchaseStatusEnum,
} from "../../../../domain/purchases";
import type {
    WooCommerceOrderStatus,
    WooCommerceOrderUpdateWebhookDto,
} from "../../../../domain/purchases/dto/WooCommerceWebhook";

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
            productId: t.Optional(t.Hex()),
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
        async ({ params: { productId }, body, headers }) => {
            const webhookData = JSON.parse(
                body
            ) as WooCommerceOrderUpdateWebhookDto;

            if (!productId) {
                throw new Error("Missing product id");
            }
            const webhook = await db.query.merchantWebhooksTable.findFirst({
                where: eq(merchantWebhooksTable.productId, productId),
            });
            if (!webhook) {
                log.warn({ productId }, "Merchant webhook not found");
                throw new Error("Merchant webhook not found");
            }

            validateBodyHmac({
                body,
                secret: webhook.hookSignatureKey,
                signature: headers["x-wc-webhook-signature"],
            });

            const purchaseStatus = mapOrderStatus(webhookData.status);

            await PurchasesContext.services.webhook.upsertPurchase({
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
                    imageUrl: item.image?.src?.length ? item.image.src : null,
                })),
            });

            return "ok";
        },
        {
            parse: "text",
            body: t.String(),
            params: t.Object({
                productId: t.Optional(t.Hex()),
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
