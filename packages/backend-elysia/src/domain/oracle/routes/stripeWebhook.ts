import { log } from "@backend-common";
import { t } from "@backend-utils";
import { isRunningInProd } from "@frak-labs/app-essentials";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { concatHex, keccak256, toHex } from "viem";
import { oracleContext } from "../context";
import {
    productOracleTable,
    type purchaseStatusEnum,
    purchaseStatusTable,
} from "../db/schema";
import type {
    PaymentIntentStatusStatus,
    StripeWebhookDto,
} from "../dto/StripeWebhook";

export const stripeWebhook = new Elysia({ prefix: "/stripe" })
    .use(oracleContext)
    // Error failsafe, to never fail on shopify webhook
    .onError(({ error, code, body, path, headers }) => {
        log.error(
            { error, code, reqPath: path, reqBody: body, reqHeaders: headers },
            "Error while handling stripe webhook"
        );
        return new Response("ko", { status: 200 });
    })
    .guard({
        headers: t.Partial(
            t.Object({
                "Stripe-Signature": t.String(),
                "Stripe-Version": t.String(),
            })
        ),
    })
    // Request pre validation hook
    .onBeforeHandle(({ headers, error }) => {
        if (!headers["Stripe-Signature"]) {
            return error(400, "Missing signature");
        }
    })
    // Shopify only give us 5sec to answer, all the heavy logic should be in a cron running elsewhere,
    //   here we should just validate the request and save it
    .post(
        ":productId/hook",
        async ({ params: { productId }, body, oracleDb, error }) => {
            // todo validation using: https://docs.stripe.com/webhooks?lang=node&verify=verify-manually#verify-manually

            // Parse the body and ensure we got everything needed for the processing
            const parsedBody = body as StripeWebhookDto;

            // Early exit cause of an invalid body
            if (!(parsedBody.type && parsedBody.data)) {
                console.error("Invalid body", { parsedBody });
                return error(400, "Invalid body");
            }

            // If the body doesn't match, abort
            const { object: event } = parsedBody.data;
            if (
                event.object !== "payment_intent" ||
                !parsedBody.type.startsWith("payment_intent.")
            ) {
                console.error("Invalid body", { parsedBody });
                return error(400, "Invalid body");
            }

            // If test and running in prod, early exit
            if (!event.livemode && isRunningInProd) {
                return error(400, "Stripe test aren't accepted in production");
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
            const purchaseStatus = mapPaymentStatus(event.status);
            const purchaseId = keccak256(
                concatHex([oracle.productId, toHex(event.id)])
            );

            log.debug(
                {
                    productId,
                    purchaseId,
                    purchaseStatus,
                    purchaseExternalId: event.id,
                    status: event.status,
                },
                "Handling new stripe webhook event"
            );

            // Format the price (since stripe as price on the minimum currency unit)
            const formattedPrice = (
                (event.amount_capturable ?? event.amount) / 100
            ).toString();

            // Insert it in the db
            await oracleDb
                .insert(purchaseStatusTable)
                .values({
                    oracleId: oracle.id,
                    purchaseId,
                    externalId: event.id,
                    externalCustomerId: event.customer ?? "unknown",
                    status: purchaseStatus,
                    totalPrice: formattedPrice,
                    currencyCode: event.currency,
                })
                .onConflictDoUpdate({
                    target: [purchaseStatusTable.purchaseId],
                    set: {
                        status: purchaseStatus,
                        totalPrice: formattedPrice,
                        currencyCode: event.currency,
                        updatedAt: new Date(),
                    },
                });

            // Return the success state
            return "ok";
        }
    );

function mapPaymentStatus(
    status: PaymentIntentStatusStatus
): (typeof purchaseStatusEnum.enumValues)[number] {
    if (status === "succeeded") {
        return "confirmed";
    }
    if (status === "canceled") {
        return "cancelled";
    }

    return "pending";
}
