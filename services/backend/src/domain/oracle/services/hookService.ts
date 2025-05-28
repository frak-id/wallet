import { log } from "@backend-common";
import type { OracleDb } from "../context";
import { purchaseItemTable, purchaseStatusTable } from "../db/schema";

export class OracleWebhookService {
    constructor(private readonly oracleDb: OracleDb) {}

    async upsertPurchase({
        purchase,
        purchaseItems,
    }: {
        purchase: typeof purchaseStatusTable.$inferInsert;
        purchaseItems: (typeof purchaseItemTable.$inferInsert)[];
    }) {
        const dbId = await this.oracleDb.transaction(async (trx) => {
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
}
