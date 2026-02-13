import { db } from "@backend-infrastructure";
import { and, eq } from "drizzle-orm";
import {
    merchantWebhooksTable,
    purchaseItemsTable,
    purchasesTable,
} from "../db/schema";

type Purchase = typeof purchasesTable.$inferSelect;
export type PurchaseInsert = Omit<typeof purchasesTable.$inferInsert, "id">;
export type PurchaseItemInsert = Omit<
    typeof purchaseItemsTable.$inferInsert,
    "id" | "purchaseId"
>;
export type MerchantWebhook = typeof merchantWebhooksTable.$inferSelect;

export class PurchaseRepository {
    async findByOrderAndToken(
        orderId: string,
        token: string
    ): Promise<Purchase | null> {
        const result = await db.query.purchasesTable.findFirst({
            where: and(
                eq(purchasesTable.externalId, orderId),
                eq(purchasesTable.purchaseToken, token)
            ),
        });
        return result ?? null;
    }

    async upsertWithItems(params: {
        purchase: PurchaseInsert;
        items: PurchaseItemInsert[];
        identityGroupId?: string;
    }): Promise<string> {
        const { purchase, items, identityGroupId } = params;

        return db.transaction(async (trx) => {
            const inserted = await trx
                .insert(purchasesTable)
                .values({
                    ...purchase,
                    identityGroupId,
                })
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
                        ...(identityGroupId ? { identityGroupId } : {}),
                    },
                })
                .returning({ purchaseId: purchasesTable.id });

            const purchaseId = inserted[0]?.purchaseId;
            if (!purchaseId) {
                throw new Error("Failed to insert purchase");
            }

            if (items.length > 0) {
                await trx
                    .insert(purchaseItemsTable)
                    .values(
                        items.map((item) => ({
                            ...item,
                            purchaseId,
                        }))
                    )
                    .onConflictDoNothing();
            }

            return purchaseId;
        });
    }

    async getWebhookByMerchantId(
        merchantId: string
    ): Promise<MerchantWebhook | null> {
        const result = await db.query.merchantWebhooksTable.findFirst({
            where: eq(merchantWebhooksTable.merchantId, merchantId),
        });
        return result ?? null;
    }
}
