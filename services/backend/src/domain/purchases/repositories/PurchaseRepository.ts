import { db } from "@backend-infrastructure";
import { and, eq } from "drizzle-orm";
import {
    merchantWebhooksTable,
    purchaseItemsTable,
    purchasesTable,
} from "../db/schema";

export type Purchase = typeof purchasesTable.$inferSelect;
export type PurchaseInsert = Omit<typeof purchasesTable.$inferInsert, "id">;
export type PurchaseItem = typeof purchaseItemsTable.$inferSelect;
export type PurchaseItemInsert = Omit<
    typeof purchaseItemsTable.$inferInsert,
    "id" | "purchaseId"
>;
export type MerchantWebhook = typeof merchantWebhooksTable.$inferSelect;

export type PurchaseWithWebhook = {
    purchase: Purchase;
    webhook: MerchantWebhook;
};

export type PurchaseWithItems = {
    purchase: Purchase;
    items: PurchaseItem[];
};

export class PurchaseRepository {
    async findById(id: string): Promise<Purchase | null> {
        const result = await db.query.purchasesTable.findFirst({
            where: eq(purchasesTable.id, id),
        });
        return result ?? null;
    }

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

    async findWithWebhook(
        purchaseId: string
    ): Promise<PurchaseWithWebhook | null> {
        const purchase = await db.query.purchasesTable.findFirst({
            where: eq(purchasesTable.id, purchaseId),
        });

        if (!purchase) {
            return null;
        }

        const webhook = await db.query.merchantWebhooksTable.findFirst({
            where: eq(merchantWebhooksTable.id, purchase.webhookId),
        });

        if (!webhook) {
            return null;
        }

        return { purchase, webhook };
    }

    async findWithItems(purchaseId: string): Promise<PurchaseWithItems | null> {
        const purchase = await db.query.purchasesTable.findFirst({
            where: eq(purchasesTable.id, purchaseId),
        });

        if (!purchase) {
            return null;
        }

        const items = await db.query.purchaseItemsTable.findMany({
            where: eq(purchaseItemsTable.purchaseId, purchaseId),
        });

        return { purchase, items };
    }

    async findItems(purchaseId: string): Promise<PurchaseItem[]> {
        return db.query.purchaseItemsTable.findMany({
            where: eq(purchaseItemsTable.purchaseId, purchaseId),
        });
    }

    async updateIdentityGroup(
        purchaseId: string,
        identityGroupId: string
    ): Promise<void> {
        await db
            .update(purchasesTable)
            .set({
                identityGroupId,
                updatedAt: new Date(),
            })
            .where(eq(purchasesTable.id, purchaseId));
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

    async getWebhookById(webhookId: number): Promise<MerchantWebhook | null> {
        const result = await db.query.merchantWebhooksTable.findFirst({
            where: eq(merchantWebhooksTable.id, webhookId),
        });
        return result ?? null;
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
