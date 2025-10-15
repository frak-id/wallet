import { db, log } from "@backend-common";
import { t, validateBodyHmac } from "@backend-utils";
import { isRunningInProd } from "@frak-labs/app-essentials";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { concatHex, keccak256, toHex } from "viem";
import {
    OracleContext,
    type OrderFinancialStatus,
    productOracleTable,
    type purchaseStatusEnum,
    type ShopifyOrderUpdateWebhookDto,
} from "../../../../domain/oracle";

export const shopifyWebhook = new Elysia()
    .guard({
        headers: t.Partial(
            t.Object({
                "x-shopify-hmac-sha256": t.String(),
                "x-shopify-api-version": t.String(),
                "x-shopify-order-id": t.Optional(t.String()),
                "x-shopify-test": t.Optional(t.Boolean()),
                // Should be used to validate the product id?
                "x-shopify-shop-domain": t.String(),
                "x-shopify-topic": t.String(),
            })
        ),
        params: t.Object({
            productId: t.Optional(t.Hex()),
        }),
    })
    // Request pre validation hook
    .onBeforeHandle(({ headers }) => {
        // If it's a test and not running in prod, early exit
        if (headers["x-shopify-test"] && isRunningInProd) {
            throw new Error("Shopify test aren't accepted in production");
        }
        // If it's an unsupported shopify version, early exit
        if (
            headers["x-shopify-api-version"] !== "2024-10" &&
            headers["x-shopify-api-version"] !== "2025-01"
        ) {
            log.warn(
                {
                    shopifyApiVersion: headers["x-shopify-api-version"],
                },
                "Unsupported shopify version, could behave strangely"
            );
        }
        // Order specific tests, should be moved elsewhere if we got other hooks
        if (!headers["x-shopify-order-id"]) {
            throw new Error("Missing order id");
        }
        if (!headers["x-shopify-topic"]?.startsWith("orders/")) {
            throw new Error("Unsupported shopify topic");
        }
    })
    // Shopify only give us 5sec to answer, all the heavy logic should be in a cron running elsewhere,
    //   here we should just validate the request and save it
    .post(
        "/shopify",
        async ({ params: { productId }, body, headers }) => {
            // Try to parse the body as a shopify webhook type and ensure the type validity
            const webhookData = JSON.parse(
                body
            ) as ShopifyOrderUpdateWebhookDto;
            // Ensure the order id match the one in the headers
            if (
                webhookData?.id !==
                Number.parseInt(headers["x-shopify-order-id"] ?? "0", 10)
            ) {
                throw new Error("Order id mismatch");
            }
            // Ensure the test field match
            if (headers["x-shopify-test"] !== webhookData?.test) {
                throw new Error("Test field mismatch");
            }

            // Find the product oracle for this product id
            if (!productId) {
                throw new Error("Missing product id");
            }
            const oracle = await db.query.productOracleTable.findFirst({
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
                signature: headers["x-shopify-hmac-sha256"],
            });

            // Prebuild some data before insert
            const purchaseStatus = mapFinancialStatus(
                webhookData.financial_status
            );
            const purchaseId = keccak256(
                concatHex([oracle.productId, toHex(webhookData.id)])
            );

            log.debug(
                {
                    productId,
                    purchaseId,
                    purchaseStatus,
                    purchaseExternalId: webhookData.id,
                    status: webhookData.financial_status,
                },
                "Handling new shopify webhook event"
            );

            // Insert purchase and items
            await OracleContext.services.webhook.upsertPurchase({
                purchase: {
                    oracleId: oracle.id,
                    purchaseId,
                    externalId: webhookData.id.toString(),
                    externalCustomerId: webhookData.customer.id.toString(),
                    purchaseToken:
                        webhookData.checkout_token ?? webhookData.token,
                    status: purchaseStatus,
                    totalPrice: webhookData.total_price,
                    currencyCode: webhookData.currency,
                },
                purchaseItems: webhookData.line_items.map((item) => ({
                    purchaseId,
                    externalId: item.product_id.toString(),
                    price: item.price,
                    name: item.name,
                    title: item.title,
                    quantity: item.quantity,
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

function mapFinancialStatus(
    financialStatus: OrderFinancialStatus
): (typeof purchaseStatusEnum.enumValues)[number] {
    if (financialStatus === "paid") {
        return "confirmed";
    }
    if (financialStatus === "refunded") {
        return "refunded";
    }
    if (financialStatus === "voided") {
        return "cancelled";
    }

    return "pending";
}
