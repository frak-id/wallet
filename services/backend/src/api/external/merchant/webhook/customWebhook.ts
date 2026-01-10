import { log } from "@backend-infrastructure";
import { t, validateBodyHmac } from "@backend-utils";
import { isRunningInProd } from "@frak-labs/app-essentials";
import { Elysia } from "elysia";
import type { CustomWebhookDto } from "../../../../domain/purchases/dto/CustomWebhook";
import { OrchestrationContext } from "../../../../orchestration/context";

export const customWebhook = new Elysia()
    .guard({
        headers: t.Partial(
            t.Object({
                "x-hmac-sha256": t.String(),
                "x-test": t.Optional(t.Boolean()),
            })
        ),
        params: t.Object({
            merchantId: t.Optional(t.String()),
        }),
    })
    .onBeforeHandle(({ headers }) => {
        if (headers["x-test"] && isRunningInProd) {
            throw new Error("Purchase test aren't accepted in production");
        }
    })
    .post(
        "/custom",
        async ({ params: { merchantId }, body, headers }) => {
            const webhookData = JSON.parse(body) as CustomWebhookDto;
            if (!webhookData?.id) {
                throw new Error("Invalid body");
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
                signature: headers["x-hmac-sha256"],
            });

            log.debug(
                {
                    merchantId: resolved.merchantId,
                    purchaseExternalId: webhookData.id,
                    status: webhookData.status,
                },
                "Handling new custom webhook event"
            );

            await OrchestrationContext.orchestrators.purchaseWebhook.upsertPurchase(
                {
                    purchase: {
                        webhookId: resolved.webhook.id,
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
