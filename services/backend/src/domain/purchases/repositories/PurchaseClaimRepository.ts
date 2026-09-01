import { db } from "@backend-infrastructure";
import { and, eq } from "drizzle-orm";
import { purchaseClaimsTable } from "../db/schema";

export type PurchaseClaim = typeof purchaseClaimsTable.$inferSelect;

type ClaimKey = {
    merchantId: string;
    orderId: string;
    purchaseToken: string;
};

export class PurchaseClaimRepository {
    /**
     * Record the identity group claiming a purchase whose webhook hasn't
     * landed yet.
     *
     * `rebindExisting` guards the unauthenticated arm (§3.9). The claim row
     * decides which identity group the purchase is attributed to once the
     * webhook arrives, so an unconditional overwrite lets whoever calls
     * `/track/purchase` last take the purchase — the same attribution
     * hijack the merge removal closes, one step earlier in the flow. The
     * trusted webhook path keeps overwriting; the SDK path is
     * first-claim-wins.
     */
    async upsert(params: {
        merchantId: string;
        customerId: string;
        orderId: string;
        purchaseToken: string;
        claimingIdentityGroupId: string;
        rebindExisting: boolean;
    }): Promise<PurchaseClaim> {
        const { rebindExisting, ...values } = params;
        const target = [
            purchaseClaimsTable.merchantId,
            purchaseClaimsTable.orderId,
            purchaseClaimsTable.purchaseToken,
        ];

        const insert = db.insert(purchaseClaimsTable).values(values);
        const [result] = await (rebindExisting
            ? insert.onConflictDoUpdate({
                  target,
                  set: {
                      claimingIdentityGroupId: values.claimingIdentityGroupId,
                      customerId: values.customerId,
                  },
              })
            : insert.onConflictDoNothing({ target })
        ).returning();

        if (result) {
            return result;
        }

        // Conflict with `onConflictDoNothing`: a claim already exists and
        // keeps its original attribution.
        const existing = await this.findByPurchaseKey(values);
        if (!existing) {
            throw new Error("Failed to upsert purchase claim");
        }
        return existing;
    }

    async findByPurchaseKey(key: ClaimKey): Promise<PurchaseClaim | null> {
        const result = await db.query.purchaseClaimsTable.findFirst({
            where: and(
                eq(purchaseClaimsTable.merchantId, key.merchantId),
                eq(purchaseClaimsTable.orderId, key.orderId),
                eq(purchaseClaimsTable.purchaseToken, key.purchaseToken)
            ),
        });
        return result ?? null;
    }

    /**
     * The oldest claim on `(merchantId, purchaseToken)`, for callers that hold
     * no `orderId`. Oldest wins so concurrent claims resolve deterministically.
     */
    async findByMerchantAndToken(params: {
        merchantId: string;
        purchaseToken: string;
    }): Promise<PurchaseClaim | null> {
        const result = await db.query.purchaseClaimsTable.findFirst({
            where: and(
                eq(purchaseClaimsTable.merchantId, params.merchantId),
                eq(purchaseClaimsTable.purchaseToken, params.purchaseToken)
            ),
            orderBy: (claims, { asc }) => [asc(claims.createdAt)],
        });
        return result ?? null;
    }

    async delete(id: string): Promise<void> {
        await db
            .delete(purchaseClaimsTable)
            .where(eq(purchaseClaimsTable.id, id));
    }
}
