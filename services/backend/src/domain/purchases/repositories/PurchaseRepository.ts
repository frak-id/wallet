import { db, log } from "@backend-infrastructure";
import {
    aliasedTable,
    and,
    eq,
    inArray,
    isNull,
    notExists,
    sql,
} from "drizzle-orm";
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
import { resolveLineTotal } from "../dto/lineItem";

// Self-join alias: the NOT EXISTS probes the same table the UPDATE writes.
const taken = aliasedTable(purchaseItemsTable, "taken");

type PurchaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Collapse items that share the line key `(purchase_id, external_id, sku)`.
 *
 * Two such rows in one statement make Postgres reject the whole insert with
 * "ON CONFLICT DO UPDATE command cannot affect row a second time", so the merge
 * is what keeps a variant cart insertable at all. Quantities and line totals are
 * summed rather than dropped — dropping is the truncation this guards against.
 */
function mergeDuplicateItems(
    items: PurchaseItemInsert[],
    purchaseId: string
): PurchaseItemInsert[] {
    const byKey = new Map<string, PurchaseItemInsert>();

    for (const item of items) {
        const key = `${item.externalId}\u0000${item.sku ?? ""}`;
        const existing = byKey.get(key);
        if (!existing) {
            byKey.set(key, item);
            continue;
        }

        log.debug(
            {
                purchaseId,
                externalId: item.externalId,
                sku: item.sku ?? null,
            },
            "Merged purchase line items sharing a product id and sku"
        );

        byKey.set(key, {
            ...existing,
            quantity: existing.quantity + item.quantity,
            totalPrice: sumLineTotals(existing, item),
        });
    }

    return [...byKey.values()];
}

/**
 * Sum two merged lines' paid totals, falling back to `price * quantity` for a
 * side that carries none so a partial total never understates the merged line.
 */
function sumLineTotals(
    a: PurchaseItemInsert,
    b: PurchaseItemInsert
): string | null {
    if (a.totalPrice == null && b.totalPrice == null) return null;
    const sum = resolveLineTotal(a) + resolveLineTotal(b);
    return Number.isFinite(sum) ? String(sum) : null;
}

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
    }): Promise<{ purchaseId: string; items: PurchaseItemInsert[] }> {
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

            const mergedItems = mergeDuplicateItems(items, purchaseId);
            await this.insertItems(trx, purchaseId, mergedItems);

            return { purchaseId, items: mergedItems };
        });
    }

    private async insertItems(
        trx: PurchaseTransaction,
        purchaseId: string,
        items: PurchaseItemInsert[]
    ): Promise<void> {
        // `items` is optional on the custom and Magento webhooks. A delivery
        // carrying none must leave the stored lines untouched, never reconcile
        // against an empty set and wipe the order.
        if (items.length === 0) return;

        await this.backfillMissingSkus(trx, purchaseId, items);
        await this.deleteItemsAbsentFrom(trx, purchaseId, items);

        await trx
            .insert(purchaseItemsTable)
            .values(items.map((item) => ({ ...item, purchaseId })))
            .onConflictDoUpdate({
                target: [
                    purchaseItemsTable.purchaseId,
                    purchaseItemsTable.externalId,
                    purchaseItemsTable.sku,
                ],
                set: {
                    // Fill-only: `excluded` is the incoming row, the qualified
                    // column the stored one.
                    totalPrice: sql`coalesce(excluded.${sql.raw(purchaseItemsTable.totalPrice.name)}, ${purchaseItemsTable.totalPrice})`,
                    imageUrl: sql`coalesce(excluded.${sql.raw(purchaseItemsTable.imageUrl.name)}, ${purchaseItemsTable.imageUrl})`,
                },
            });
    }

    /**
     * Adopt sku-less rows written before the merchant's plugin sent SKUs,
     * preserving the enrichments already stored on them.
     *
     * The sku is part of the line key, so without this a redelivery that starts
     * carrying one leaves the stored NULL row behind for the reconciliation to
     * delete, losing its `total_price` and `image_url`.
     */
    private async backfillMissingSkus(
        trx: PurchaseTransaction,
        purchaseId: string,
        items: PurchaseItemInsert[]
    ): Promise<void> {
        const skusByExternalId = new Map<string, (string | null)[]>();
        for (const item of items) {
            const skus = skusByExternalId.get(item.externalId) ?? [];
            skus.push(item.sku ?? null);
            skusByExternalId.set(item.externalId, skus);
        }

        // Only where the product has exactly one incoming line, and it carries
        // a sku: with more the stored NULL cannot be attributed to a variant.
        const adoptable: [string, string][] = [];
        for (const [externalId, skus] of skusByExternalId) {
            const [sku] = skus;
            if (skus.length === 1 && sku != null) {
                adoptable.push([externalId, sku]);
            }
        }

        for (const [externalId, sku] of adoptable) {
            await trx
                .update(purchaseItemsTable)
                .set({ sku })
                .where(
                    and(
                        eq(purchaseItemsTable.purchaseId, purchaseId),
                        eq(purchaseItemsTable.externalId, externalId),
                        isNull(purchaseItemsTable.sku),
                        // The target key may already exist, and adopting onto it
                        // would violate `purchase_items_line_idx`.
                        notExists(
                            trx
                                .select({ one: sql`1` })
                                .from(taken)
                                .where(
                                    and(
                                        eq(taken.purchaseId, purchaseId),
                                        eq(taken.externalId, externalId),
                                        eq(taken.sku, sku)
                                    )
                                )
                        )
                    )
                );
        }
    }

    /**
     * Drop stored lines absent from the delivery, so the stored set equals
     * the incoming one and both claim paths read the same items.
     */
    private async deleteItemsAbsentFrom(
        trx: PurchaseTransaction,
        purchaseId: string,
        items: PurchaseItemInsert[]
    ): Promise<void> {
        const stale = items.map(
            (item) =>
                sql`not (${purchaseItemsTable.externalId} = ${item.externalId} and ${purchaseItemsTable.sku} is not distinct from ${item.sku ?? null})`
        );

        await trx
            .delete(purchaseItemsTable)
            .where(
                and(eq(purchaseItemsTable.purchaseId, purchaseId), ...stale)
            );
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
