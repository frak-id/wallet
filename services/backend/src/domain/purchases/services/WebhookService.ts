import { db, log } from "@backend-infrastructure";
import { purchaseItemsTable, purchasesTable } from "../db/schema";

type PurchaseInsert = Omit<typeof purchasesTable.$inferInsert, "id">;
type PurchaseItemInsert = Omit<
    typeof purchaseItemsTable.$inferInsert,
    "id" | "purchaseId"
>;

export class PurchasesWebhookService {
    async upsertPurchase({
        purchase,
        purchaseItems,
    }: {
        purchase: PurchaseInsert;
        purchaseItems: PurchaseItemInsert[];
    }) {
        const dbId = await db.transaction(async (trx) => {
            const inserted = await trx
                .insert(purchasesTable)
                .values(purchase)
                .onConflictDoUpdate({
                    target: [
                        purchasesTable.externalId,
                        purchasesTable.webhookId,
                    ],
                    set: {
                        status: purchase.status,
                        totalPrice: purchase.totalPrice,
                        currencyCode: purchase.currencyCode,
                        updatedAt: new Date(),
                        ...(purchase.purchaseToken
                            ? { purchaseToken: purchase.purchaseToken }
                            : {}),
                    },
                })
                .returning({ purchaseId: purchasesTable.id });

            const purchaseId = inserted[0]?.purchaseId;
            if (!purchaseId) {
                throw new Error("Failed to insert purchase");
            }

            if (purchaseItems.length > 0) {
                await trx
                    .insert(purchaseItemsTable)
                    .values(
                        purchaseItems.map((item) => ({
                            ...item,
                            purchaseId,
                        }))
                    )
                    .onConflictDoNothing();
            }

            return purchaseId;
        });
        log.debug(
            { purchase, purchaseItems, insertedId: dbId },
            "Purchase upserted"
        );
    }
}
