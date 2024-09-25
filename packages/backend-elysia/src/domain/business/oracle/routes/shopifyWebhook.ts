import { t } from "@backend-utils";
import { isRunningInProd } from "@frak-labs/app-essentials";
import { eq } from "drizzle-orm";
import Elysia from "elysia";
import { concatHex, keccak256, toHex } from "viem";
import {
    productOracleTable,
    type purchaseStatusEnum,
    purchaseStatusTable,
} from "../../db/schema";
import { businessOracleContext } from "../context";
import type {
    OrderFinancialStatus,
    ShopifyOrderUpdateWebhookDto,
} from "../dto/ShopifyWebhook";

export const shopifyWebhook = new Elysia({ prefix: "shopify" })
    .use(businessOracleContext)
    .guard({
        // todo: Partial to be removed after testing
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
    })
    // Request pre validation hook
    .onBeforeHandle(({ headers, error }) => {
        // If it's a test and not running in prod, early exit
        // todo: Maybe accept them but not save the order in the merklee tree?
        if (headers["x-shopify-test"] && isRunningInProd) {
            return error(400, "Shopify test arn't accepted in production");
        }
        // If it's an unsported shopify version, early exit
        if (headers["x-shopify-api-version"] !== "2024-10") {
            return error(400, "Unsupported shopify version");
        }
        // Order specific tests, should be moved elsewhere if we got other hooks
        if (!headers["x-shopify-order-id"]) {
            return error(400, "Missing order id");
        }
        if (!headers["x-shopify-topic"]?.startsWith("orders/")) {
            return error(400, "Unsupported shopify topic");
        }
    })
    // Shopify only give us 5sec to answer, all the heavy logic should be in a cron running elsewhere,
    //   here we should just validate the request and save it
    .post(
        ":productId/hook",
        async ({ params: { productId }, body, headers, businessDb, error }) => {
            // todo: hmac validation

            // Try to parse the body as a shopify webhook type and ensure the type validity
            const webhookData = body as ShopifyOrderUpdateWebhookDto;
            // Ensure the order id match the one in the headers
            if (
                webhookData?.id !==
                Number.parseInt(headers["x-shopify-order-id"] ?? "0")
            ) {
                return error(400, "Order id mismatch");
            }
            // Ensure the test field match
            if (headers["x-shopify-test"] !== webhookData?.test) {
                return error(400, "Test field mismatch");
            }

            // Find the product oracle for this product id
            if (!productId) {
                return error(400, "Missing product id");
            }
            const oracle = await businessDb.query.productOracleTable.findFirst({
                where: eq(productOracleTable.productId, productId),
            });
            if (!oracle) {
                return error(404, "Product oracle not found");
            }

            // Prebuild some data before insert
            const purchaseStatus = mapFinancialStatus(
                webhookData.financial_status
            );
            const purchaseId = keccak256(
                concatHex([oracle.productId, toHex(webhookData.id)])
            );

            console.log("Handling new webhook", {
                productId,
                purchaseId,
                purchaseStatus,
                purchaseExternalId: webhookData.id,
                status: webhookData.financial_status,
            });

            // Insert the purchase in the database
            await businessDb
                .insert(purchaseStatusTable)
                .values({
                    oracleId: oracle.id,
                    purchaseId,
                    externalId: webhookData.id.toString(),
                    status: purchaseStatus,
                    totalPrice: webhookData.total_price,
                    currencyCode: webhookData.currency,
                })
                .onConflictDoUpdate({
                    target: [purchaseStatusTable.purchaseId],
                    set: {
                        status: purchaseStatus,
                        totalPrice: webhookData.total_price,
                        currencyCode: webhookData.currency,
                        updatedAt: new Date(),
                    },
                });

            return "ok";
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
