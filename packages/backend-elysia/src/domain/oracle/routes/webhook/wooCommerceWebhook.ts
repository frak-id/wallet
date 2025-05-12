import { log } from "@backend-common";
import { t, validateBodyHmac } from "@backend-utils";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { concatHex, keccak256, toHex } from "viem";
import { productOracleTable, type purchaseStatusEnum } from "../../db/schema";
import type {
    WooCommerceOrderStatus,
    WooCommerceOrderUpdateWebhookDto,
} from "../../dto/WooCommerceWebhook";
import { purchaseWebhookService } from "../../services/hookService";

export const wooCommerceWebhook = new Elysia({ prefix: "/woocommerce" })
    .use(purchaseWebhookService)
    // Error failsafe, to never fail on shopify webhook
    .onError(({ error, code, body, path, headers, response }) => {
        log.error(
            {
                error,
                code,
                reqPath: path,
                reqBody: body,
                reqHeaders: headers,
                response,
            },
            "Error while handling WooCommerce webhook"
        );
        return new Response("ko", { status: 200 });
    })
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
    })
    // Request pre validation hook
    .onBeforeHandle(({ headers, error }) => {
        if (!headers["x-wc-webhook-signature"]) {
            return error(400, "Missing signature");
        }
        if (headers["x-wc-webhook-resource"] !== "order") {
            return error(400, "Unsupported woo commerce webhook");
        }
    })
    // Shopify only give us 5sec to answer, all the heavy logic should be in a cron running elsewhere,
    //   here we should just validate the request and save it
    .post(
        ":productId/hook",
        async ({
            // Query
            params: { productId },
            body,
            headers,
            error,
            // Context
            oracleDb,
            upsertPurchase,
        }) => {
            // Try to parse the body as a shopify webhook type and ensure the type validity
            const webhookData = JSON.parse(
                body
            ) as WooCommerceOrderUpdateWebhookDto;

            // Find the product oracle for this product id
            if (!productId) {
                return error(400, "Missing product id");
            }
            const oracle = await oracleDb.query.productOracleTable.findFirst({
                where: eq(productOracleTable.productId, productId),
            });
            if (!oracle) {
                return error(404, "Product oracle not found");
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
            await upsertPurchase({
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
