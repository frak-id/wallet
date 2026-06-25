import { db } from "@backend-infrastructure";
import { and, eq } from "drizzle-orm";
import { affiliateBrandTable } from "../db/schema";
import type { AffiliateProvider } from "../provider";

type AffiliateBrandSelect = typeof affiliateBrandTable.$inferSelect;

export class AffiliateBrandRepository {
    /**
     * Link (or re-link) an internal merchant to a provider brand. Idempotent
     * on `(merchantId, provider)` so a re-registration / catalog refresh just
     * updates the captured values.
     */
    async link(params: {
        merchantId: string;
        provider: AffiliateProvider;
        externalId: string;
        trackingLink: string;
        metadata?: Record<string, unknown>;
    }): Promise<AffiliateBrandSelect> {
        const [result] = await db
            .insert(affiliateBrandTable)
            .values({
                merchantId: params.merchantId,
                provider: params.provider,
                externalId: params.externalId,
                trackingLink: params.trackingLink,
                metadata: params.metadata,
            })
            .onConflictDoUpdate({
                target: [
                    affiliateBrandTable.merchantId,
                    affiliateBrandTable.provider,
                ],
                set: {
                    externalId: params.externalId,
                    trackingLink: params.trackingLink,
                    metadata: params.metadata,
                    updatedAt: new Date(),
                },
            })
            .returning();
        return result;
    }

    async findByMerchantAndProvider(
        merchantId: string,
        provider: AffiliateProvider
    ): Promise<AffiliateBrandSelect | null> {
        const result = await db.query.affiliateBrandTable.findFirst({
            where: and(
                eq(affiliateBrandTable.merchantId, merchantId),
                eq(affiliateBrandTable.provider, provider)
            ),
        });
        return result ?? null;
    }

    async findByProviderAndExternalId(
        provider: AffiliateProvider,
        externalId: string
    ): Promise<AffiliateBrandSelect | null> {
        const result = await db.query.affiliateBrandTable.findFirst({
            where: and(
                eq(affiliateBrandTable.provider, provider),
                eq(affiliateBrandTable.externalId, externalId)
            ),
        });
        return result ?? null;
    }
}
