import { db } from "@backend-infrastructure";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
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
                        // First-writer-wins: Shopify/Magento redeliver `orders/updated`
                        // repeatedly (capture, fulfilment, refund), and this
                        // identityGroupId derives from a client-controlled
                        // `_frak-client-id` cart attribute. Overwriting on every
                        // redelivery would let an attacker who completes a real order
                        // with a victim's clientId planted in the cart repoint
                        // attribution after the fact. COALESCE keeps whatever the row
                        // already has (a bare column reference here is the EXISTING
                        // row, not `excluded`) and only fills it in when still NULL —
                        // done in SQL so it can't race across concurrent deliveries.
                        ...(identityGroupId
                            ? {
                                  identityGroupId: sql`coalesce(${purchasesTable.identityGroupId}, ${identityGroupId})`,
                              }
                            : {}),
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

    /**
     * Repoint a purchase's attribution, compare-and-swap on the value the
     * caller observed.
     *
     * Same first-writer-wins concern as `upsertWithItems`: `/track/purchase`
     * is unauthenticated and reaches this through a late claim, so a plain
     * `WHERE id = ?` would let two concurrent claims both read a NULL
     * `identity_group_id` and both write, last one silently winning.
     * Swapping on the observed value makes the DB arbitrate instead.
     *
     * @returns The row's attribution after the attempt: `identityGroupId` when
     *   the swap landed, or whatever the winning writer stored when it didn't.
     */
    async updateIdentityGroup(
        purchaseId: string,
        identityGroupId: string,
        expectedIdentityGroupId: string | null
    ): Promise<string | null> {
        const updated = await db
            .update(purchasesTable)
            .set({ identityGroupId, updatedAt: new Date() })
            .where(
                and(
                    eq(purchasesTable.id, purchaseId),
                    expectedIdentityGroupId === null
                        ? isNull(purchasesTable.identityGroupId)
                        : eq(
                              purchasesTable.identityGroupId,
                              expectedIdentityGroupId
                          )
                )
            )
            .returning({ identityGroupId: purchasesTable.identityGroupId });

        if (updated.length > 0) {
            return identityGroupId;
        }

        const current = await db.query.purchasesTable.findFirst({
            where: eq(purchasesTable.id, purchaseId),
            columns: { identityGroupId: true },
        });
        return current?.identityGroupId ?? null;
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
