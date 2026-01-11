import { db } from "@backend-infrastructure";
import { and, eq, lt } from "drizzle-orm";
import { purchaseClaimsTable } from "../db/schema";

export type PurchaseClaim = typeof purchaseClaimsTable.$inferSelect;

type ClaimKey = {
    merchantId: string;
    orderId: string;
    purchaseToken: string;
};

export class PurchaseClaimRepository {
    async upsert(params: {
        merchantId: string;
        customerId: string;
        orderId: string;
        purchaseToken: string;
        claimingIdentityGroupId: string;
    }): Promise<PurchaseClaim> {
        const [result] = await db
            .insert(purchaseClaimsTable)
            .values(params)
            .onConflictDoUpdate({
                target: [
                    purchaseClaimsTable.merchantId,
                    purchaseClaimsTable.orderId,
                    purchaseClaimsTable.purchaseToken,
                ],
                set: {
                    claimingIdentityGroupId: params.claimingIdentityGroupId,
                    customerId: params.customerId,
                },
            })
            .returning();

        if (!result) {
            throw new Error("Failed to upsert purchase claim");
        }
        return result;
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

    async delete(id: string): Promise<void> {
        await db
            .delete(purchaseClaimsTable)
            .where(eq(purchaseClaimsTable.id, id));
    }

    async deleteStale(olderThan: Date): Promise<number> {
        const result = await db
            .delete(purchaseClaimsTable)
            .where(lt(purchaseClaimsTable.createdAt, olderThan))
            .returning({ id: purchaseClaimsTable.id });
        return result.length;
    }
}
