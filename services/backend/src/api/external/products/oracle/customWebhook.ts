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
            identifier: t.Optional(t.String()),
        }),
    })
    .onBeforeHandle(({ headers }) => {
        if (headers["x-test"] && isRunningInProd) {
            throw new Error("Purchase test aren't accepted in production");
        }
    })
    .post(
        "/custom",
        async ({ params: { identifier }, body, headers }) => {
            const webhookData = JSON.parse(body) as CustomWebhookDto;
            if (!webhookData?.id) {
                throw new Error("Invalid body");
            }

            if (!identifier) {
                throw new Error("Missing merchant identifier");
            }

            const resolved =
                await OrchestrationContext.orchestrators.webhookResolver.resolveWebhook(
                    identifier
                );
            if (!resolved) {
                log.warn({ identifier }, "Webhook not found");
                throw new Error("Webhook not found");
            }

            const { webhook, merchantId } = resolved;

            validateBodyHmac({
                body,
                secret: webhook.hookSignatureKey,
                signature: headers["x-hmac-sha256"],
            });

            log.debug(
                {
                    merchantId,
                    purchaseExternalId: webhookData.id,
                    status: webhookData.status,
                },
                "Handling new custom webhook event"
            );

            await OrchestrationContext.orchestrators.purchaseWebhook.upsertPurchase(
                {
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
                    merchantId,
                }
            );

            return "ok";
        },
        {
            parse: "text",
            body: t.String(),
            params: t.Object({
                identifier: t.Optional(t.String()),
            }),
        }
    );
