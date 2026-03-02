import { and, desc, eq, gt, isNull, lt, or } from "drizzle-orm";
import type { Address } from "viem";
import { db } from "../../../infrastructure/persistence/postgres";
import { touchpointsTable } from "../db/schema";
import type { TouchpointSource, TouchpointSourceData } from "../schemas/index";

export type CreateTouchpointParams = {
    identityGroupId: string;
    merchantId: string;
    source: TouchpointSource;
    sourceData: TouchpointSourceData;
    landingUrl?: string;
    lookbackDays?: number;
};

export type Touchpoint = typeof touchpointsTable.$inferSelect;

const DEFAULT_LOOKBACK_DAYS = 30;

export class TouchpointRepository {
    async create(params: CreateTouchpointParams): Promise<Touchpoint> {
        const lookbackDays = params.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + lookbackDays);

        const [touchpoint] = await db
            .insert(touchpointsTable)
            .values({
                identityGroupId: params.identityGroupId,
                merchantId: params.merchantId,
                source: params.source,
                sourceData: params.sourceData,
                landingUrl: params.landingUrl,
                expiresAt,
            })
            .returning();

        return touchpoint;
    }

    async findValidForAttribution(params: {
        identityGroupId: string;
        merchantId: string;
    }): Promise<Touchpoint[]> {
        const now = new Date();

        return db
            .select()
            .from(touchpointsTable)
            .where(
                and(
                    eq(
                        touchpointsTable.identityGroupId,
                        params.identityGroupId
                    ),
                    eq(touchpointsTable.merchantId, params.merchantId),
                    or(
                        isNull(touchpointsTable.expiresAt),
                        gt(touchpointsTable.expiresAt, now)
                    )
                )
            )
            .orderBy(desc(touchpointsTable.createdAt));
    }

    async findLatestReferralTouchpoint(params: {
        identityGroupId: string;
        merchantId: string;
    }): Promise<(Touchpoint & { referrerWallet: Address }) | null> {
        const now = new Date();

        const touchpoints = await db
            .select()
            .from(touchpointsTable)
            .where(
                and(
                    eq(
                        touchpointsTable.identityGroupId,
                        params.identityGroupId
                    ),
                    eq(touchpointsTable.merchantId, params.merchantId),
                    eq(touchpointsTable.source, "referral_link"),
                    or(
                        isNull(touchpointsTable.expiresAt),
                        gt(touchpointsTable.expiresAt, now)
                    )
                )
            )
            .orderBy(desc(touchpointsTable.createdAt))
            .limit(1);

        const touchpoint = touchpoints[0];
        if (!touchpoint) return null;

        const sourceData = touchpoint.sourceData as TouchpointSourceData;
        if (sourceData.type !== "referral_link") return null;

        return {
            ...touchpoint,
            referrerWallet: sourceData.referrerWallet,
        };
    }

    async deleteExpired(): Promise<number> {
        const now = new Date();

        const result = await db
            .delete(touchpointsTable)
            .where(lt(touchpointsTable.expiresAt, now))
            .returning({ id: touchpointsTable.id });

        return result.length;
    }
}
