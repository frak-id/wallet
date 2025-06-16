import { t, validateBodyHmac } from "@backend-utils";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { concatHex, keccak256, toHex } from "viem";
import { log } from "../../../../common";
import {
    type WooCommerceOrderStatus,
    type WooCommerceOrderUpdateWebhookDto,
    oracleContext,
    productOracleTable,
    type purchaseStatusEnum,
} from "../../../../domain/oracle";

export const wooCommerceWebhook = new Elysia()
    .use(oracleContext)
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
    // Request pre validation hook
    .onBeforeHandle(({ headers }) => {
        if (!headers["x-wc-webhook-signature"]) {
            throw new Error("Missing signature");
        }
        if (headers["x-wc-webhook-resource"] !== "order") {
            throw new Error("Unsupported woo commerce webhook");
        }
    })
    // Shopify only give us 5sec to answer, all the heavy logic should be in a cron running elsewhere,
    //   here we should just validate the request and save it
    .post(
        "/woocommerce",
        async ({
            // Query
            params: { productId },
            body,
            headers,
            // Context
            oracle: {
                db: oracleDb,
                services: { webhook },
            },
        }) => {
            // Try to parse the body as a shopify webhook type and ensure the type validity
            const webhookData = JSON.parse(
                body
            ) as WooCommerceOrderUpdateWebhookDto;

            // Find the product oracle for this product id
            if (!productId) {
                throw new Error("Missing product id");
            }
            const oracle = await oracleDb.query.productOracleTable.findFirst({
                where: eq(productOracleTable.productId, productId),
            });
            if (!oracle) {
                log.warn({ productId }, "Product oracle not found");
                throw new Error("Product oracle not found");
            }

            // Validate the body hmac
            validateBodyHmac({
                body,
                secret: oracle.hookSignatureKey,
                signature: headers["x-wc-webhook-signature"],
            });

            // Prebuild some data before insert
            const purchaseStatus = mapOrderStatus(webhookData.status);
            const purchaseId = keccak256(
                concatHex([oracle.productId, toHex(webhookData.id)])
            );

            // Insert purchase and items
            await webhook.upsertPurchase({
                purchase: {
                    oracleId: oracle.id,
                    purchaseId,
                    externalId: webhookData.id.toString(),
                    externalCustomerId: webhookData.customer_id.toString(),
                    purchaseToken:
                        webhookData.order_key ?? webhookData.transaction_id,
                    status: purchaseStatus,
                    totalPrice: webhookData.total,
                    currencyCode: webhookData.currency,
                },
                purchaseItems: webhookData.line_items.map((item) => ({
                    purchaseId,
                    externalId: item.product_id.toString(),
                    price: item.price.toString(),
                    name: item.name,
                    title: item.name,
                    quantity: item.quantity,
                    imageUrl: item.image?.src?.length ? item.image.src : null,
                })),
            });

            // Return the success state
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
