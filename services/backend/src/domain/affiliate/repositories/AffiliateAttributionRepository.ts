import { db } from "@backend-infrastructure";
import { HttpError } from "@backend-utils";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
    type AffiliateAttributionSelect,
    affiliateAttributionTable,
} from "../db/schema";
import type { AffiliateProvider } from "../provider";

export class AffiliateAttributionRepository {
    /**
     * Batch lookup for a page of TakeAds actions: one round-trip for the whole
     * page. Dedupes the input and returns a Map keyed
     * by token so callers can look up a miss (foreign/unknown subId) as an
     * absent key.
     */
    async findByTokens(
        tokens: string[]
    ): Promise<Map<string, AffiliateAttributionSelect>> {
        const deduped = [...new Set(tokens)];
        if (deduped.length === 0) return new Map();

        const rows = await db
            .select()
            .from(affiliateAttributionTable)
            .where(inArray(affiliateAttributionTable.token, deduped));

        return new Map(rows.map((row) => [row.token, row]));
    }

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
     * return the existing one. Race-safe: on conflict on the
     * `(provider, identityGroupId, merchantId)` unique index, the update is a
     * no-op SET (identityGroupId set to itself) so two concurrent mints
     * converge on one token — in a single round-trip instead of an
     * insert-then-re-read.
     */
    async mint(params: {
        token: string;
        provider: AffiliateProvider;
        identityGroupId: string;
        merchantId: string;
        trackingLink?: string;
    }): Promise<AffiliateAttributionSelect> {
        const [row] = await db
            .insert(affiliateAttributionTable)
            .values({
                token: params.token,
                provider: params.provider,
                identityGroupId: params.identityGroupId,
                merchantId: params.merchantId,
                trackingLink: params.trackingLink,
            })
            .onConflictDoUpdate({
                target: [
                    affiliateAttributionTable.provider,
                    affiliateAttributionTable.identityGroupId,
                    affiliateAttributionTable.merchantId,
                ],
                set: {
                    identityGroupId: sql`${affiliateAttributionTable.identityGroupId}`,
                },
            })
            .returning();

        if (!row) {
            // The unique index guarantees a row exists on conflict, so an empty
            // returning() here means something is structurally broken.
            throw HttpError.internal(
                "ATTRIBUTION_MINT_INVARIANT",
                "Affiliate attribution row missing after insert conflict"
            );
        }
        return row;
    }
}
