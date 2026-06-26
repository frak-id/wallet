import { db } from "@backend-infrastructure";
import { and, eq, sql } from "drizzle-orm";
import { affiliateSyncStateTable } from "../db/schema";
import type { AffiliateProvider } from "../provider";

export class AffiliateSyncStateRepository {
    async getWatermark(
        provider: AffiliateProvider,
        stream: string
    ): Promise<Date | null> {
        const result = await db.query.affiliateSyncStateTable.findFirst({
            where: and(
                eq(affiliateSyncStateTable.provider, provider),
                eq(affiliateSyncStateTable.stream, stream)
            ),
        });
        return result?.watermark ?? null;
    }

    async advanceWatermark(
        provider: AffiliateProvider,
        stream: string,
        watermark: Date
    ): Promise<void> {
        await db
            .insert(affiliateSyncStateTable)
            .values({ provider, stream, watermark, updatedAt: new Date() })
            .onConflictDoUpdate({
                target: [
                    affiliateSyncStateTable.provider,
                    affiliateSyncStateTable.stream,
                ],
                set: {
                    // COALESCE first: PG's GREATEST propagates NULL, so a row
                    // with a NULL watermark would otherwise swallow the update
                    // and freeze the cursor forever.
                    watermark: sql`GREATEST(COALESCE(${affiliateSyncStateTable.watermark}, '-infinity'::timestamptz), EXCLUDED.watermark)`,
                    updatedAt: new Date(),
                },
            });
    }
}
