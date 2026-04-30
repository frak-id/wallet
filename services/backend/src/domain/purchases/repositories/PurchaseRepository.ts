import { db } from "@backend-infrastructure";
import { and, eq, inArray } from "drizzle-orm";
import {
    type MerchantWebhook,
    merchantWebhooksTable,
    type PurchaseInsert,
    type PurchaseItemInsert,
    type PurchaseItemSelect,
    type PurchaseSelect,
    purchaseItemsTable,
    purchasesTable,
} from "../db/schema";

export class PurchaseRepository {
    async findByOrderAndToken(
        orderId: string,
        token: string
    ): Promise<PurchaseSelect | null> {
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

    async updateIdentityGroup(
        purchaseId: string,
        identityGroupId: string
    ): Promise<void> {
        await db
            .update(purchasesTable)
            .set({ identityGroupId, updatedAt: new Date() })
            .where(eq(purchasesTable.id, purchaseId));
    }

    async getWebhookByMerchantId(
        merchantId: string
    ): Promise<MerchantWebhook | null> {
        const result = await db.query.merchantWebhooksTable.findFirst({
            where: eq(merchantWebhooksTable.merchantId, merchantId),
        });
        return result ?? null;
    }

    async findByMerchantAndCheckoutToken(params: {
        webhookId: number;
        checkoutToken: string;
    }): Promise<PurchaseSelect | null> {
        const { webhookId, checkoutToken } = params;
        const result = await db.query.purchasesTable.findFirst({
            where: and(
                eq(purchasesTable.purchaseToken, checkoutToken),
                eq(purchasesTable.webhookId, webhookId)
            ),
        });
        return result ?? null;
    }

    async findByIds(ids: string[]): Promise<PurchaseSelect[]> {
        if (ids.length === 0) return [];
        return db
            .select()
            .from(purchasesTable)
            .where(inArray(purchasesTable.id, ids));
    }

    async findItemsByPurchaseId(
        purchaseId: string
    ): Promise<PurchaseItemSelect[]> {
        return db
            .select()
            .from(purchaseItemsTable)
            .where(eq(purchaseItemsTable.purchaseId, purchaseId));
    }
}
