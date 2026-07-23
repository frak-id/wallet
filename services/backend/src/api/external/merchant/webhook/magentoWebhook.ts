import { HttpError, t } from "@backend-utils";
import { Elysia } from "elysia";
import type { PurchaseStatus } from "../../../../domain/purchases";
import type {
    MagentoOrderStatus,
    MagentoOrderWebhookDto,
} from "../../../../domain/purchases/dto/MagentoWebhook";
import { OrchestrationContext } from "../../../../orchestration/context";
import { resolveAndVerifyWebhook } from "./resolveAndVerifyWebhook";

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

            const resolved = await resolveAndVerifyWebhook({
                merchantId,
                body,
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
                    // Magento's `name` field carries the SKU (see the DTO's
                    // `// SKU` comment) and `title` is the display name.
                    // We preserve the existing `name`-based mapping
                    // (back-compat for any name-based matching already in
                    // use) and additionally surface it as `sku` so
                    // SKU-based productScope matching works for Magento too.
                    purchaseItems: (webhookData.items ?? []).map((item) => ({
                        externalId: item.productId,
                        price: item.price,
                        name: item.name,
                        title: item.title,
                        quantity: item.quantity,
                        imageUrl: item.image ?? null,
                        sku: item.name,
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
