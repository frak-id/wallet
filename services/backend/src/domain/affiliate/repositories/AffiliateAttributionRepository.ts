import { db } from "@backend-infrastructure";
import { and, eq } from "drizzle-orm";
import { affiliateAttributionTable } from "../db/schema";
import type { AffiliateProvider } from "../provider";

type AffiliateAttributionSelect = typeof affiliateAttributionTable.$inferSelect;

export class AffiliateAttributionRepository {
    async findByUserAndBrand(params: {
        provider: AffiliateProvider;
        identityGroupId: string;
        merchantId: string;
    }): Promise<AffiliateAttributionSelect | null> {
        const result = await db.query.affiliateAttributionTable.findFirst({
            where: and(
                eq(affiliateAttributionTable.provider, params.provider),
                eq(
                    affiliateAttributionTable.identityGroupId,
                    params.identityGroupId
                ),
                eq(affiliateAttributionTable.merchantId, params.merchantId)
            ),
        });
        return result ?? null;
    }

    /**
     * Mint a stable attribution token for a (provider, user, brand) triple, or
     * return the existing one. Race-safe: the insert is a no-op on the
     * `(provider, identityGroupId, merchantId)` unique index, so two concurrent
     * mints converge on one token (we re-read on conflict instead of trusting
     * the empty `returning()`).
     */
    async mint(params: {
        token: string;
        provider: AffiliateProvider;
        identityGroupId: string;
        merchantId: string;
        trackingLink?: string;
        couponCode?: string;
    }): Promise<AffiliateAttributionSelect> {
        const [inserted] = await db
            .insert(affiliateAttributionTable)
            .values({
                token: params.token,
                provider: params.provider,
                identityGroupId: params.identityGroupId,
                merchantId: params.merchantId,
                trackingLink: params.trackingLink,
                couponCode: params.couponCode,
            })
            .onConflictDoNothing({
                target: [
                    affiliateAttributionTable.provider,
                    affiliateAttributionTable.identityGroupId,
                    affiliateAttributionTable.merchantId,
                ],
            })
            .returning();

        if (inserted) {
            return inserted;
        }

        // Lost the insert race (or token already existed): the row is
        // guaranteed present by the unique index, so re-read it.
        const existing = await this.findByUserAndBrand({
            provider: params.provider,
            identityGroupId: params.identityGroupId,
            merchantId: params.merchantId,
        });
        if (!existing) {
            throw new Error(
                "affiliate attribution mint failed: row missing after conflict"
            );
        }
        return existing;
    }
}
