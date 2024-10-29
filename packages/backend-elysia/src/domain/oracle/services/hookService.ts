import { log } from "@backend-common";
import Elysia from "elysia";
import { oracleContext } from "../context";
import { purchaseItemTable, purchaseStatusTable } from "../db/schema";

export const purchaseWebhookService = new Elysia({
    name: "Service.PurchaseWebhook",
})
    .use(oracleContext)
    .decorate(({ oracleDb, ...decorators }) => {
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
        };
    });
