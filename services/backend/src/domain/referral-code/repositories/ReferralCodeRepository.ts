import { db } from "@backend-infrastructure";
import { generateCandidates } from "@backend-utils";
import { and, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { type ReferralCodeSelect, referralCodesTable } from "../db/schema";

/**
 * Revoked codes stay redeemable for this long after revocation. Lets
 * existing shares keep working when an influencer rotates, and blocks
 * the same code string from being re-issued during the grace window.
 *
 * After the window elapses, the cleanup cron deletes the row; the string
 * becomes available again for a fresh owner to claim.
 */
export const REVOKED_CODE_GRACE_DAYS = 14;

const gracePeriodSql = sql`now() - interval '${sql.raw(
    String(REVOKED_CODE_GRACE_DAYS)
)} days'`;

export class ReferralCodeRepository {
    /**
     * Insert a new active referral code for the given owner. Tries the
     * caller-supplied `candidates` in order and returns the first one that
     * passes the collision check; returns `null` if none do.
     *
     * Two modes:
     *  - **Random** (default): pass the full batch of `generateCandidates()`.
     *    Statistically never returns null against the 887M namespace.
     *  - **Specific claim**: pass `[userPickedCode]`. Returns null when the
     *    pick collides with an active row or an in-grace revoked row — the
     *    service maps that to `CODE_UNAVAILABLE`.
     *
     * The in-grace check here prevents a fresh owner from inheriting an
     * influencer's recently-shared string while the grace window is active.
     */
    async create(params: {
        ownerIdentityGroupId: string;
        candidates?: string[];
    }): Promise<ReferralCodeSelect | null> {
        const { ownerIdentityGroupId } = params;
        const candidates = params.candidates ?? generateCandidates();
        if (candidates.length === 0) return null;

        const values = sql.join(
            candidates.map((c) => sql`(${c.toUpperCase()}::text)`),
            sql`, `
        );

        const result = await db.execute<{
            id: string;
            code: string;
            owner_identity_group_id: string;
            created_at: Date;
            revoked_at: Date | null;
        }>(sql`
            WITH candidates(code) AS (VALUES ${values})
            INSERT INTO referral_codes (code, owner_identity_group_id)
            SELECT c.code, ${ownerIdentityGroupId}::uuid
            FROM candidates c
            WHERE NOT EXISTS (
                SELECT 1 FROM referral_codes rc
                WHERE rc.code = c.code
                  AND (
                      rc.revoked_at IS NULL
                      OR rc.revoked_at > ${gracePeriodSql}
                  )
            )
            LIMIT 1
            ON CONFLICT DO NOTHING
            RETURNING *
        `);

        const row = [...result][0];
        if (!row) return null;

        return {
            id: row.id,
            code: row.code,
            ownerIdentityGroupId: row.owner_identity_group_id,
            createdAt: row.created_at,
            revokedAt: row.revoked_at,
        };
    }

    /**
     * Lookup a referral code for redemption.
     *
     * Returns a row when:
     *  - an active row exists (revoked_at IS NULL), OR
     *  - a row revoked within the grace period exists.
     *
     * When both coexist (new owner issued after an old one was revoked but
     * before cleanup ran — shouldn't happen because `create` blocks it, but
     * defensive), the active row wins.
     */
    async findByCode(code: string): Promise<ReferralCodeSelect | null> {
        const [result] = await db
            .select()
            .from(referralCodesTable)
            .where(
                and(
                    eq(referralCodesTable.code, code.toUpperCase()),
                    or(
                        isNull(referralCodesTable.revokedAt),
                        sql`${referralCodesTable.revokedAt} > ${gracePeriodSql}`
                    )
                )
            )
            .orderBy(sql`${referralCodesTable.revokedAt} IS NULL DESC`)
            .limit(1);
        return result ?? null;
    }

    async findActiveByOwner(
        ownerIdentityGroupId: string
    ): Promise<ReferralCodeSelect | null> {
        const result = await db.query.referralCodesTable.findFirst({
            where: and(
                eq(
                    referralCodesTable.ownerIdentityGroupId,
                    ownerIdentityGroupId
                ),
                isNull(referralCodesTable.revokedAt)
            ),
        });
        return result ?? null;
    }

    /**
     * Set revokedAt on the active row (if any) for the owner. Returns the
     * revoked row or null when the owner has no active code.
     */
    async revokeActiveByOwner(
        ownerIdentityGroupId: string
    ): Promise<ReferralCodeSelect | null> {
        const [result] = await db
            .update(referralCodesTable)
            .set({ revokedAt: new Date() })
            .where(
                and(
                    eq(
                        referralCodesTable.ownerIdentityGroupId,
                        ownerIdentityGroupId
                    ),
                    isNull(referralCodesTable.revokedAt)
                )
            )
            .returning();
        return result ?? null;
    }

    /**
     * Purge rows whose revocation predates the grace period. Intended to be
     * called from a daily cleanup cron. Returns the number of deleted rows.
     */
    async deleteExpiredRevoked(): Promise<number> {
        const cutoff = new Date(
            Date.now() - REVOKED_CODE_GRACE_DAYS * 24 * 60 * 60 * 1000
        );
        const result = await db
            .delete(referralCodesTable)
            .where(lt(referralCodesTable.revokedAt, cutoff))
            .returning({ id: referralCodesTable.id });
        return result.length;
    }

    /**
     * Given an array of candidate 6-char strings, return the subset that is
     * currently *available* — neither an active row nor a row revoked within
     * the grace window. Single DB round-trip.
     *
     * Order of the input is preserved in the output so callers can drive a
     * preference (e.g. digit-filled candidates first).
     */
    async filterAvailableCandidates(candidates: string[]): Promise<string[]> {
        if (candidates.length === 0) return [];

        const normalized = candidates.map((c) => c.toUpperCase());

        const takenRows = await db
            .select({ code: referralCodesTable.code })
            .from(referralCodesTable)
            .where(
                and(
                    inArray(referralCodesTable.code, normalized),
                    or(
                        isNull(referralCodesTable.revokedAt),
                        sql`${referralCodesTable.revokedAt} > ${gracePeriodSql}`
                    )
                )
            );

        const taken = new Set(takenRows.map((r) => r.code));
        return normalized.filter((c) => !taken.has(c));
    }
}
