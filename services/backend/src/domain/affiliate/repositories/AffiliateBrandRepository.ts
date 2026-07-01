import { db } from "@backend-infrastructure";
import { HttpError } from "@backend-utils";
import { and, eq } from "drizzle-orm";
import { type AffiliateBrandSelect, affiliateBrandTable } from "../db/schema";
import type { AffiliateProvider } from "../provider";

/** Postgres unique-violation error code. */
const UNIQUE_VIOLATION = "23505";

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
    }): Promise<void> {
        try {
            await db
                .insert(affiliateBrandTable)
                .values({
                    merchantId: params.merchantId,
                    provider: params.provider,
                    externalId: params.externalId,
                    trackingLink: params.trackingLink,
                })
                .onConflictDoUpdate({
                    target: [
                        affiliateBrandTable.merchantId,
                        affiliateBrandTable.provider,
                    ],
                    set: {
                        externalId: params.externalId,
                        trackingLink: params.trackingLink,
                        updatedAt: new Date(),
                    },
                });
        } catch (error) {
            // The onConflictDoUpdate target above only covers
            // (merchantId, provider); a concurrent registration of the same
            // externalId under a different merchant instead hits the
            // (provider, externalId) unique index and surfaces here.
            if (isProviderExternalUniqueViolation(error)) {
                throw HttpError.conflict(
                    "AFFILIATE_BRAND_TAKEN",
                    `Affiliate brand ${params.externalId} is already linked to another merchant`
                );
            }
            throw error;
        }
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

/** Detects a unique-violation on `affiliate_brand_provider_external_unique`. */
function isProviderExternalUniqueViolation(error: unknown): boolean {
    const pgError = error as { code?: string; constraint_name?: string };
    return (
        pgError?.code === UNIQUE_VIOLATION &&
        (pgError?.constraint_name?.includes("provider_external") ?? false)
    );
}
