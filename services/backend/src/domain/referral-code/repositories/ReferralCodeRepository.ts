import { db } from "@backend-infrastructure";
import { CANDIDATE_BATCH_SIZE, generateCandidates } from "@backend-utils";
import { and, eq, isNull, sql } from "drizzle-orm";
import { type ReferralCodeSelect, referralCodesTable } from "../db/schema";

export class ReferralCodeRepository {
    /**
     * Insert a new active referral code for the given owner.
     *
     * Reuses the shared 6-digit candidate batch primitive (same alphabet /
     * length / collision-resistance pattern as install_codes). The partial
     * unique on `owner_identity_group_id WHERE revoked_at IS NULL` is the
     * final guarantee that a single owner can never hold two active rows; if
     * that invariant is violated (concurrent issue), `null` is returned.
     */
    async create(params: {
        ownerIdentityGroupId: string;
    }): Promise<ReferralCodeSelect | null> {
        const { ownerIdentityGroupId } = params;

        const candidates = generateCandidates();
        const values = sql.join(
            candidates.map((c) => sql`(${c}::text)`),
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
                WHERE rc.code = c.code AND rc.revoked_at IS NULL
            )
            LIMIT 1
            ON CONFLICT DO NOTHING
            RETURNING *
        `);

        const row = [...result][0];
        if (!row) {
            throw new Error(
                `Failed to generate unique referral code from ${CANDIDATE_BATCH_SIZE} candidates`
            );
        }

        return {
            id: row.id,
            code: row.code,
            ownerIdentityGroupId: row.owner_identity_group_id,
            createdAt: row.created_at,
            revokedAt: row.revoked_at,
        };
    }

    /**
     * Lookup a referral code by its 6-char value (case-insensitive), across
     * BOTH active and revoked rows. Callers that need active-only must check
     * `revokedAt === null`.
     *
     * Looking up revoked codes on purpose: when a user redeems a code, we
     * want the FK in `referral_links.referral_code_id` to resolve even if
     * the owner has since rotated their active code.
     */
    async findByCode(code: string): Promise<ReferralCodeSelect | null> {
        const result = await db.query.referralCodesTable.findFirst({
            where: eq(referralCodesTable.code, code.toUpperCase()),
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
}
