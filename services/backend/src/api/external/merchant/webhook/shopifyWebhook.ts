import { log } from "@backend-infrastructure";
import { t, validateBodyHmac } from "@backend-utils";
import { isRunningInProd } from "@frak-labs/app-essentials";
import { Elysia } from "elysia";
import type { purchaseStatusEnum } from "../../../../domain/purchases";
import type {
    OrderFinancialStatus,
    ShopifyOrderUpdateWebhookDto,
} from "../../../../domain/purchases/dto/ShopifyWebhook";
import { OrchestrationContext } from "../../../../orchestration/context";

export const shopifyWebhook = new Elysia()
    .guard({
        headers: t.Partial(
            t.Object({
                "x-shopify-hmac-sha256": t.String(),
                "x-shopify-api-version": t.String(),
                "x-shopify-order-id": t.Optional(t.String()),
                "x-shopify-test": t.Optional(t.Boolean()),
                "x-shopify-shop-domain": t.String(),
                "x-shopify-topic": t.String(),
            })
        ),
        params: t.Object({
            merchantId: t.Optional(t.String()),
        }),
    })
    .onBeforeHandle(({ headers }) => {
        if (headers["x-shopify-test"] && isRunningInProd) {
            throw new Error("Shopify test aren't accepted in production");
        }
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
        if (!headers["x-shopify-order-id"]) {
            throw new Error("Missing order id");
        }
        if (!headers["x-shopify-topic"]?.startsWith("orders/")) {
            throw new Error("Unsupported shopify topic");
        }
    })
    .post(
        "/shopify",
        async ({ params: { merchantId }, body, headers }) => {
            const webhookData = JSON.parse(
                body
            ) as ShopifyOrderUpdateWebhookDto;
            if (
                webhookData?.id !==
                Number.parseInt(headers["x-shopify-order-id"] ?? "0", 10)
            ) {
                throw new Error("Order id mismatch");
            }
            if (headers["x-shopify-test"] !== webhookData?.test) {
                throw new Error("Test field mismatch");
            }

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
                signature: headers["x-shopify-hmac-sha256"],
            });

            const purchaseStatus = mapFinancialStatus(
                webhookData.financial_status
            );

            log.debug(
                {
                    merchantId: resolved.merchantId,
                    purchaseStatus,
                    purchaseExternalId: webhookData.id,
                    status: webhookData.financial_status,
                },
                "Handling new shopify webhook event"
            );

            await OrchestrationContext.orchestrators.purchaseWebhook.upsertPurchase(
                {
                    purchase: {
                        webhookId: resolved.webhook.id,
                        externalId: webhookData.id.toString(),
                        externalCustomerId: webhookData.customer.id.toString(),
                        purchaseToken:
                            webhookData.checkout_token ?? webhookData.token,
                        status: purchaseStatus,
                        totalPrice: webhookData.total_price,
                        currencyCode: webhookData.currency,
                    },
                    purchaseItems: webhookData.line_items.map((item) => ({
                        externalId: item.product_id.toString(),
                        price: item.price,
                        name: item.name,
                        title: item.title,
                        quantity: item.quantity,
                    })),
                    merchantId: resolved.merchantId,
                }
            );

            return "ok";
        },
        {
            parse: "text",
            body: t.String(),
            params: t.Object({
                merchantId: t.Optional(t.String()),
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
