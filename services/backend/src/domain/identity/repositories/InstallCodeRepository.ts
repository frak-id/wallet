import { db } from "@backend-infrastructure";
import { CANDIDATE_BATCH_SIZE, generateCandidates } from "@backend-utils";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { installCodesTable } from "../db/schema";

const CODE_TTL_HOURS = 72;

/**
 * Max resolve attempts against a single install code. Caps repeated
 * hammering of one already-minted code independently of source IP —
 * durable across pod replicas, unlike `rateLimitMiddleware`'s in-memory
 * store. Does not bound enumeration of the ~887M-code keyspace.
 */
export const MAX_RESOLVE_ATTEMPTS = 20;

type InstallCodeSelect = typeof installCodesTable.$inferSelect;

export class InstallCodeRepository {
    async create(params: {
        merchantId: string;
        anonymousId: string;
    }): Promise<InstallCodeSelect> {
        const { merchantId, anonymousId } = params;

        const candidates = generateCandidates();

        const values = sql.join(
            candidates.map((c) => sql`(${c}::text)`),
            sql`, `
        );

        const result = await db.execute<{
            id: string;
            code: string;
            merchant_id: string;
            anonymous_id: string;
            created_at: Date;
            expires_at: Date;
            attempts: number;
        }>(sql`
            WITH candidates(code) AS (VALUES ${values})
            INSERT INTO install_codes (code, merchant_id, anonymous_id, expires_at)
            SELECT c.code, ${merchantId}::uuid, ${anonymousId}, now() + ${CODE_TTL_HOURS} * interval '1 hour'
            FROM candidates c
            WHERE NOT EXISTS (
                SELECT 1 FROM install_codes ic WHERE ic.code = c.code
            )
            LIMIT 1
            ON CONFLICT (code) DO NOTHING
            RETURNING *
        `);

        const row = [...result][0];
        if (!row) {
            throw new Error(
                `Failed to generate unique install code from ${CANDIDATE_BATCH_SIZE} candidates`
            );
        }

        return {
            id: row.id,
            code: row.code,
            merchantId: row.merchant_id,
            anonymousId: row.anonymous_id,
            createdAt: row.created_at,
            expiresAt: row.expires_at,
            attempts: row.attempts,
        };
    }

    /**
     * Resolve a code and atomically count the attempt against it in one
     * round-trip (UPDATE … RETURNING, not read-then-write) so concurrent
     * guesses can't race past `MAX_RESOLVE_ATTEMPTS`. Returns `null` once
     * expired, not found, or exhausted — callers can't distinguish which,
     * which is deliberate: a distinguishable "exhausted" response would leak
     * that the code was real.
     */
    async findByCode(code: string): Promise<InstallCodeSelect | null> {
        const [result] = await db
            .update(installCodesTable)
            .set({ attempts: sql`${installCodesTable.attempts} + 1` })
            .where(
                and(
                    eq(installCodesTable.code, code.toUpperCase()),
                    gt(installCodesTable.expiresAt, new Date()),
                    lt(installCodesTable.attempts, MAX_RESOLVE_ATTEMPTS)
                )
            )
            .returning();
        return result ?? null;
    }

    async deleteExpired(): Promise<number> {
        const result = await db
            .delete(installCodesTable)
            .where(lt(installCodesTable.expiresAt, new Date()));
        return result.length;
    }
}
