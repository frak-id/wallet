import { db, log } from "@backend-common";
import { t, validateBodyHmac } from "@backend-utils";
import { isRunningInProd } from "@frak-labs/app-essentials";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { concatHex, keccak256, toHex } from "viem";
import {
    type CustomWebhookDto,
    OracleContext,
    productOracleTable,
} from "../../../../domain/oracle";

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
    // Request pre validation hook
    .onBeforeHandle(({ headers }) => {
        // If it's a test and not running in prod, early exit
        if (headers["x-test"] && isRunningInProd) {
            throw new Error("Purchase test aren't accepted in production");
        }
    })
    .post(
        "/custom",
        async ({ params: { productId }, body, headers }) => {
            // Try to parse the body as a custom webhook type and ensure the type validity
            const webhookData = JSON.parse(body) as CustomWebhookDto;
            if (!webhookData?.id) {
                throw new Error("Invalid body");
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
                signature: headers["x-hmac-sha256"],
            });

            // Prebuild some data before insert
            const purchaseId = keccak256(
                concatHex([oracle.productId, toHex(webhookData.id)])
            );

            log.debug(
                {
                    productId,
                    purchaseId,
                    purchaseExternalId: webhookData.id,
                    status: webhookData.status,
                },
                "Handling new custom webhook event"
            );

            // Insert purchase and items
            await OracleContext.services.webhook.upsertPurchase({
                purchase: {
                    oracleId: oracle.id,
                    purchaseId,
                    externalId: webhookData.id,
                    externalCustomerId: webhookData.customerId,
                    purchaseToken: webhookData.token,
                    status: webhookData.status,
                    totalPrice: webhookData.totalPrice ?? "",
                    currencyCode: webhookData.currency ?? "",
                },
                purchaseItems:
                    webhookData.items?.map((item) => ({
                        purchaseId,
                        externalId: item.productId,
                        price: item.price,
                        name: item.name,
                        title: item.title,
                        quantity: item.quantity,
                        imageUrl: item.image,
                    })) ?? [],
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
