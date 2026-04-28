import { log } from "@backend-infrastructure";
import { HttpError, t, validateBodyHmac } from "@backend-utils";
import { Elysia } from "elysia";
import type { PurchaseStatus } from "../../../../domain/purchases";
import type {
    MagentoOrderStatus,
    MagentoOrderWebhookDto,
} from "../../../../domain/purchases/dto/MagentoWebhook";
import { OrchestrationContext } from "../../../../orchestration/context";

export const magentoWebhook = new Elysia()
    .guard({
        headers: t.Partial(
            t.Object({
                "x-hmac-sha256": t.String(),
            })
        ),
        params: t.Object({
            merchantId: t.Optional(t.String()),
        }),
    })
    .onBeforeHandle(({ headers }) => {
        if (!headers["x-hmac-sha256"]) {
            throw HttpError.badRequest(
                "WEBHOOK_ERROR",
                "Missing HMAC signature"
            );
        }
    })
    .post(
        "/magento",
        async ({ params: { merchantId }, body, headers }) => {
            const webhookData = JSON.parse(body) as MagentoOrderWebhookDto;

            if (!merchantId) {
                throw HttpError.badRequest(
                    "WEBHOOK_ERROR",
                    "Missing merchant identifier"
                );
            }

            const resolved =
                await OrchestrationContext.orchestrators.webhookResolver.resolveWebhook(
                    merchantId
                );
            if (!resolved) {
                log.warn({ merchantId }, "Webhook not found");
                throw HttpError.badRequest(
                    "WEBHOOK_ERROR",
                    "Webhook not found"
                );
            }

            validateBodyHmac({
                body,
                secret: resolved.webhook.hookSignatureKey,
                signature: headers["x-hmac-sha256"],
            });

            const purchaseStatus = mapOrderStatus(webhookData.status);

            await OrchestrationContext.orchestrators.purchaseWebhook.upsertPurchase(
                {
                    purchase: {
                        webhookId: resolved.webhook.id,
                        externalId: webhookData.id,
                        externalCustomerId: webhookData.customerId,
                        purchaseToken: webhookData.token,
                        status: purchaseStatus,
                        totalPrice: webhookData.totalPrice ?? "0",
                        currencyCode: webhookData.currency ?? "EUR",
                    },
                    purchaseItems: (webhookData.items ?? []).map((item) => ({
                        externalId: item.productId,
                        price: item.price,
                        name: item.name,
                        title: item.title,
                        quantity: item.quantity,
                        imageUrl: item.image ?? null,
                    })),
                    merchantId: resolved.merchantId,
                    clientId: webhookData.clientId,
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

function mapOrderStatus(orderStatus: MagentoOrderStatus): PurchaseStatus {
    if (orderStatus === "confirmed") {
        return "confirmed";
    }
    if (orderStatus === "refunded") {
        return "refunded";
    }

    return "pending";
}
