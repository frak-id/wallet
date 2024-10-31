import { log } from "@backend-common";
import { CryptoHasher } from "bun";
import Elysia from "elysia";
import { oracleContext } from "../context";
import { purchaseItemTable, purchaseStatusTable } from "../db/schema";

export const purchaseWebhookService = new Elysia({
    name: "Service.PurchaseWebhook",
})
    .use(oracleContext)
    .decorate(({ oracleDb, ...decorators }) => {
        /**
         * Validate a body hmac signature
         */
        function validateBodyHmac({
            body,
            secret,
            signature,
        }: {
            body: string;
            secret: string;
            signature?: string;
        }) {
            // hmac hash of the body
            const hasher = new CryptoHasher("sha256", secret);
            hasher.update(body);

            // Convert both to buffer
            const recomputedSignature = hasher.digest();
            const baseSignature = Buffer.from(signature ?? "", "base64");

            // Compare the two
            if (!baseSignature.equals(recomputedSignature)) {
                log.warn(
                    {
                        signature,
                        baseSignature: baseSignature.toString("hex"),
                        recomputedSignatureHex:
                            recomputedSignature.toString("hex"),
                        recomputedSignatureB64:
                            recomputedSignature.toString("base64"),
                    },
                    "Signature mismatch"
                );
            } else {
                log.debug(
                    {
                        recomputedSignature:
                            recomputedSignature.toString("hex"),
                        baseSignature: baseSignature.toString("hex"),
                    },
                    "Signature matches"
                );
            }
        }

        /**
         * Upsert a purchase in the database
         * @returns
         */
        async function upsertPurchase({
            purchase,
            purchaseItems,
        }: {
            purchase: typeof purchaseStatusTable.$inferInsert;
            purchaseItems: (typeof purchaseItemTable.$inferInsert)[];
        }) {
            const dbId = await oracleDb.transaction(async (trx) => {
                // Insert the purchase first
                const insertedId = await trx
                    .insert(purchaseStatusTable)
                    .values(purchase)
                    .onConflictDoUpdate({
                        target: [purchaseStatusTable.purchaseId],
                        set: {
                            status: purchase.status,
                            totalPrice: purchase.totalPrice,
                            currencyCode: purchase.currencyCode,
                            // Reset leaf on update
                            leaf: null,
                            updatedAt: new Date(),
                            ...(purchase.purchaseToken
                                ? {
                                      purchaseToken: purchase.purchaseToken,
                                  }
                                : {}),
                        },
                    })
                    .returning({ purchaseId: purchaseStatusTable.id });

                // Insert the items if needed
                if (purchaseItems.length > 0) {
                    await trx
                        .insert(purchaseItemTable)
                        .values(purchaseItems)
                        .onConflictDoNothing();
                }

                return insertedId;
            });
            log.debug(
                { purchase, purchaseItems, insertedId: dbId },
                "Purchase upserted"
            );
        }

        return {
            ...decorators,
            oracleDb,
            upsertPurchase,
            validateBodyHmac,
        };
    });
