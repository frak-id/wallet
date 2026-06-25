import { db } from "@backend-infrastructure";
import { eq } from "drizzle-orm";
import { takeadsMerchantTable } from "../db/schema";

type TakeadsMerchantSelect = typeof takeadsMerchantTable.$inferSelect;

export class TakeadsMerchantRepository {
    /**
     * Link (or re-link) an internal merchant to its TakeAds brand. Idempotent
     * on `merchantId` so a re-registration / catalog refresh just updates the
     * captured values.
     */
    async link(params: {
        merchantId: string;
        takeadsMerchantId: number;
        trackingLink: string;
    }): Promise<TakeadsMerchantSelect> {
        const [result] = await db
            .insert(takeadsMerchantTable)
            .values({
                merchantId: params.merchantId,
                takeadsMerchantId: params.takeadsMerchantId,
                trackingLink: params.trackingLink,
            })
            .onConflictDoUpdate({
                target: takeadsMerchantTable.merchantId,
                set: {
                    takeadsMerchantId: params.takeadsMerchantId,
                    trackingLink: params.trackingLink,
                    updatedAt: new Date(),
                },
            })
            .returning();
        return result;
    }

    async findByMerchantId(
        merchantId: string
    ): Promise<TakeadsMerchantSelect | null> {
        const result = await db.query.takeadsMerchantTable.findFirst({
            where: eq(takeadsMerchantTable.merchantId, merchantId),
        });
        return result ?? null;
    }

    async findByTakeadsMerchantId(
        takeadsMerchantId: number
    ): Promise<TakeadsMerchantSelect | null> {
        const result = await db.query.takeadsMerchantTable.findFirst({
            where: eq(
                takeadsMerchantTable.takeadsMerchantId,
                takeadsMerchantId
            ),
        });
        return result ?? null;
    }
}
