import { db } from "@backend-infrastructure";
import { generateCandidates } from "@backend-utils";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { type ReferralCodeSelect, referralCodesTable } from "../db/schema";

export class ReferralCodeRepository {
    /**
     * Insert a new active referral code for the given owner. Tries the
     * caller-supplied `candidates` in order and returns the first one that
     * passes the collision check; returns `null` if none do.
     *
     * Two modes:
     *  - **Random** (default): pass the full batch of `generateCandidates()`.
     *    Statistically never returns null against the ~887M namespace.
     *  - **Specific claim**: pass `[userPickedCode]`. Returns null when the
     *    pick collides with an active row — the service maps that to
     *    `CODE_UNAVAILABLE`.
     *
     * Revoked rows are archived-only and never compete for the code string,
     * so the collision check filters on `revoked_at IS NULL`. The partial
     * unique index `referral_codes_code_active_idx` is the final guard.
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
                  AND rc.revoked_at IS NULL
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
     * Lookup an active referral code by its string. Revoked rows are
     * archived-only and do not resolve — revoke means "no new redemptions".
     * Existing `referral_links` rows that point to a revoked code via
     * `referral_code_id` remain intact.
     */
    async findByCode(code: string): Promise<ReferralCodeSelect | null> {
        const result = await db.query.referralCodesTable.findFirst({
            where: and(
                eq(referralCodesTable.code, code.toUpperCase()),
                isNull(referralCodesTable.revokedAt)
            ),
        });
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
     * Given an array of candidate 6-char strings, return the subset that is
     * currently available (no active row holds it). Single DB round-trip.
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
                    isNull(referralCodesTable.revokedAt)
                )
            );

        const taken = new Set(takenRows.map((r) => r.code));
        return normalized.filter((c) => !taken.has(c));
    }
}
