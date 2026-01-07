import { db, log } from "@backend-infrastructure";
import { t, validateBodyHmac } from "@backend-utils";
import { isRunningInProd } from "@frak-labs/app-essentials";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import {
    merchantWebhooksTable,
    PurchasesContext,
} from "../../../../domain/purchases";
import type { CustomWebhookDto } from "../../../../domain/purchases/dto/CustomWebhook";

export const customWebhook = new Elysia()
    .guard({
        headers: t.Partial(
            t.Object({
                "x-hmac-sha256": t.String(),
                "x-test": t.Optional(t.Boolean()),
            })
        ),
        params: t.Object({
            productId: t.Optional(t.Hex()),
        }),
    })
    .onBeforeHandle(({ headers }) => {
        if (headers["x-test"] && isRunningInProd) {
            throw new Error("Purchase test aren't accepted in production");
        }
    })
    .post(
        "/custom",
        async ({ params: { productId }, body, headers }) => {
            const webhookData = JSON.parse(body) as CustomWebhookDto;
            if (!webhookData?.id) {
                throw new Error("Invalid body");
            }

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
                signature: headers["x-hmac-sha256"],
            });

            log.debug(
                {
                    productId,
                    purchaseExternalId: webhookData.id,
                    status: webhookData.status,
                },
                "Handling new custom webhook event"
            );

            await PurchasesContext.services.webhook.upsertPurchase({
                purchase: {
                    webhookId: webhook.id,
                    externalId: webhookData.id,
                    externalCustomerId: webhookData.customerId,
                    purchaseToken: webhookData.token,
                    status: webhookData.status,
                    totalPrice: webhookData.totalPrice ?? "",
                    currencyCode: webhookData.currency ?? "",
                },
                purchaseItems:
                    webhookData.items?.map((item) => ({
                        externalId: item.productId,
                        price: item.price,
                        name: item.name,
                        title: item.title,
                        quantity: item.quantity,
                        imageUrl: item.image,
                    })) ?? [],
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
