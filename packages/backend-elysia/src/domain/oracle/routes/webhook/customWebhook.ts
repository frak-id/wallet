import { log } from "@backend-common";
import { t, validateBodyHmac } from "@backend-utils";
import { isRunningInProd } from "@frak-labs/app-essentials";
import { eq } from "drizzle-orm";
import { Elysia, status } from "elysia";
import { concatHex, keccak256, toHex } from "viem";
import { productOracleTable } from "../../db/schema";
import type { CustomWebhookDto } from "../../dto/CustomWebhook";
import { purchaseWebhookService } from "../../services/hookService";

export const customWebhook = new Elysia({ prefix: "/custom" })
    .use(purchaseWebhookService)
    // Error failsafe, to never fail on shopify webhook
    .onError(({ error, code, body, path, headers }) => {
        log.error(
            { error, code, reqPath: path, reqBody: body, reqHeaders: headers },
            "Error while handling custom webhook"
        );
        return new Response("ko", { status: 200 });
    })
    .guard({
        headers: t.Partial(
            t.Object({
                "x-hmac-sha256": t.String(),
                "x-test": t.Optional(t.Boolean()),
            })
        ),
    })
    // Request pre validation hook
    .onBeforeHandle(({ headers }) => {
        // If it's a test and not running in prod, early exit
        if (headers["x-test"] && isRunningInProd) {
            return status(400, "Purchase test aren't accepted in production");
        }
    })
    .post(
        ":productId/hook",
        async ({
            params: { productId },
            body,
            headers,
            oracleDb,
            upsertPurchase,
        }) => {
            // Try to parse the body as a custom webhook type and ensure the type validity
            const webhookData = JSON.parse(body) as CustomWebhookDto;
            if (!webhookData?.id) {
                return status(400, "Invalid body");
            }

            // Find the product oracle for this product id
            if (!productId) {
                return status(400, "Missing product id");
            }
            const oracle = await oracleDb.query.productOracleTable.findFirst({
                where: eq(productOracleTable.productId, productId),
            });
            if (!oracle) {
                return status(404, "Product oracle not found");
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
            await upsertPurchase({
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
