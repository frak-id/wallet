import { log } from "@backend-common";
import { t } from "@backend-utils";
import { isRunningInProd } from "@frak-labs/app-essentials";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { concatHex, keccak256, toHex } from "viem";
import { productOracleTable, type purchaseStatusEnum } from "../../db/schema";
import type {
    OrderFinancialStatus,
    ShopifyOrderUpdateWebhookDto,
} from "../../dto/ShopifyWebhook";
import { purchaseWebhookService } from "../../services/hookService";

export const shopifyWebhook = new Elysia({ prefix: "/shopify" })
    .use(purchaseWebhookService)
    // Error failsafe, to never fail on shopify webhook
    .onError(({ error, code, body, path, headers }) => {
        log.error(
            { error, code, reqPath: path, reqBody: body, reqHeaders: headers },
            "Error while handling shopify webhook"
        );
        return new Response("ko", { status: 200 });
    })
    .mapResponse(({ response }) => {
        if ("code" in response && response.code !== 200) {
            log.error({ response }, "Error while handling shopify webhook");
            return new Response("ko", { status: 200 });
        }

        return response;
    })
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
    })
    // Request pre validation hook
    .onBeforeHandle(({ headers, error }) => {
        // If it's a test and not running in prod, early exit
        if (headers["x-shopify-test"] && isRunningInProd) {
            return error(400, "Shopify test aren't accepted in production");
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
        async ({
            params: { productId },
            body,
            headers,
            oracleDb,
            upsertPurchase,
            error,
        }) => {
            // todo: hmac validation in the `onParse` hook? https://shopify.dev/docs/apps/build/webhooks/subscribe/https#step-2-validate-the-origin-of-your-webhook-to-ensure-its-coming-from-shopify

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
            const oracle = await oracleDb.query.productOracleTable.findFirst({
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
            await upsertPurchase({
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
