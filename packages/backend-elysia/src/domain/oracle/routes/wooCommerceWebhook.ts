import { log } from "@backend-common";
import { t } from "@backend-utils";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { concatHex, keccak256, toHex } from "viem";
import { oracleContext } from "../context";
import {
    productOracleTable,
    purchaseItemTable,
    type purchaseStatusEnum,
    purchaseStatusTable,
} from "../db/schema";
import type {
    WooCommerceOrderStatus,
    WooCommerceOrderUpdateWebhookDto,
} from "../dto/WooCommerceWebhook";

export const wooCommerceWebhook = new Elysia({ prefix: "/wooCommerce" })
    .use(oracleContext)
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
            "Error while handling woo commerce webhook"
        );
        return new Response("ko", { status: 200 });
    })
    .mapResponse(({ response }) => {
        if ("code" in response && response.code !== 200) {
            log.error({ response }, "Error while handling WooCommerce webhook");
            return new Response("ko", { status: 200 });
        }

        return response;
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
        async ({ params: { productId }, body, headers, oracleDb, error }) => {
            log.debug(
                {
                    productId,
                    body,
                    headers,
                },
                "WooCommerce inner hook"
            );

            // Try to parse the body as a shopify webhook type and ensure the type validity
            const webhookData = body as WooCommerceOrderUpdateWebhookDto;

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

            // Prebuild some data before insert
            const purchaseStatus = mapOrderStatus(webhookData.status);
            const purchaseId = keccak256(
                concatHex([oracle.productId, toHex(webhookData.id)])
            );

            // Insert purchase and items
            await oracleDb.transaction(async (trx) => {
                // Insert the purchase first
                await trx
                    .insert(purchaseStatusTable)
                    .values({
                        oracleId: oracle.id,
                        purchaseId,
                        externalId: webhookData.id.toString(),
                        externalCustomerId: webhookData.customer_id.toString(),
                        purchaseToken:
                            webhookData.order_key ?? webhookData.transaction_id,
                        status: purchaseStatus,
                        totalPrice: webhookData.total,
                        currencyCode: webhookData.currency,
                    })
                    .onConflictDoUpdate({
                        target: [purchaseStatusTable.purchaseId],
                        set: {
                            status: purchaseStatus,
                            totalPrice: webhookData.total,
                            currencyCode: webhookData.currency,
                            updatedAt: new Date(),
                            ...(webhookData.order_key
                                ? {
                                      purchaseToken: webhookData.order_key,
                                  }
                                : {}),
                        },
                    });
                // Insert the items if needed
                if (webhookData.line_items.length === 0) {
                    return;
                }
                const mappedItems = webhookData.line_items.map((item) => ({
                    purchaseId,
                    externalId: item.product_id.toString(),
                    price: item.price.toString(),
                    name: item.name,
                    title: item.name,
                    quantity: item.quantity,
                }));
                await trx.insert(purchaseItemTable).values(mappedItems);
            });
            log.debug(
                {
                    purchaseId,
                    purchaseStatus,
                    externalId: webhookData.id.toString(),
                    externalCustomerId: webhookData.customer_id.toString(),
                    purchaseToken:
                        webhookData.order_key ?? webhookData.transaction_id,
                    totalPrice: webhookData.total,
                    currencyCode: webhookData.currency,
                },
                "WooCommerce Purchase inserted"
            );

            // Return the success state
            return "ok";
        },
        {
            response: {
                200: t.String(),
                400: t.String(),
                404: t.String(),
            },
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
