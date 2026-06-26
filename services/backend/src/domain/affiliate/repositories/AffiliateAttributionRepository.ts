import { db } from "@backend-infrastructure";
import { HttpError } from "@backend-utils";
import { and, eq } from "drizzle-orm";
import {
    type AffiliateAttributionSelect,
    affiliateAttributionTable,
} from "../db/schema";
import type { AffiliateProvider } from "../provider";

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
    }): Promise<AffiliateAttributionSelect> {
        const [inserted] = await db
            .insert(affiliateAttributionTable)
            .values({
                token: params.token,
                provider: params.provider,
                identityGroupId: params.identityGroupId,
                merchantId: params.merchantId,
                trackingLink: params.trackingLink,
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
            throw HttpError.internal(
                "ATTRIBUTION_MINT_INVARIANT",
                "Affiliate attribution row missing after insert conflict"
            );
        }
        return existing;
    }
}
