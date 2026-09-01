import { db } from "@backend-infrastructure";
import { CANDIDATE_BATCH_SIZE, generateCandidates } from "@backend-utils";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { installCodesTable } from "../db/schema";

/** How long a minted install code stays redeemable. */
export const CODE_TTL_HOURS = 72;

/**
 * Max resolve attempts against a single install code, durable across pod replicas unlike
 * `rateLimitMiddleware`'s in-memory store. Does not bound enumeration of the keyspace.
 */
export const MAX_RESOLVE_ATTEMPTS = 20;

/** Below this, a code could expire while its user is still at the store. */
const REUSE_MIN_REMAINING_HOURS = 6;

type InstallCodeSelect = typeof installCodesTable.$inferSelect;

/**
 * The credential a code is minted against. A union rather than two optional
 * fields so "neither present" is unrepresentable rather than a CHECK violation.
 */
export type InstallCodeCredential =
    | { kind: "anonymous"; anonymousId: string }
    | {
          kind: "checkoutToken";
          checkoutToken: string;
          anonymousId: string | null;
      };

export class InstallCodeRepository {
    /**
     * The live code for the presented credential, minting one only when there is none usable.
     * Reuse never extends `expires_at`, which would keep one credential alive indefinitely.
     * Exhausted rows are excluded: exhaustion happens in the app, so a reload is the only
     * recovery.
     */
    async create(params: {
        merchantId: string;
        credential: InstallCodeCredential;
    }): Promise<InstallCodeSelect & { reused: boolean }> {
        const { merchantId, credential } = params;

        // Either identifier matches, so a deferred row minted before the
        // webhook landed is still reused once the ladder resolves its id.
        const anonymousId = credential.anonymousId;
        const checkoutToken =
            credential.kind === "checkoutToken"
                ? credential.checkoutToken
                : null;

        const candidates = generateCandidates();

        const values = sql.join(
            candidates.map((c) => sql`(${c}::text)`),
            sql`, `
        );

        // One statement: concurrent loads of this page are routine, and
        // read-then-write would let both miss and both mint.
        const result = await db.execute<{
            id: string;
            code: string;
            merchant_id: string;
            anonymous_id: string | null;
            checkout_token: string | null;
            created_at: Date;
            expires_at: Date;
            attempts: number;
            reused: boolean;
        }>(sql`
            WITH reusable AS (
                SELECT * FROM install_codes
                WHERE merchant_id = ${merchantId}::uuid
                  AND (
                        (${anonymousId}::text IS NOT NULL AND anonymous_id = ${anonymousId}::text)
                     OR (${checkoutToken}::text IS NOT NULL AND checkout_token = ${checkoutToken}::text)
                      )
                  AND expires_at > now() + ${REUSE_MIN_REMAINING_HOURS} * interval '1 hour'
                  AND attempts < ${MAX_RESOLVE_ATTEMPTS}
                ORDER BY expires_at DESC
                LIMIT 1
            ),
            candidates(code) AS (VALUES ${values}),
            minted AS (
                INSERT INTO install_codes (code, merchant_id, anonymous_id, checkout_token, expires_at)
                SELECT c.code, ${merchantId}::uuid, ${anonymousId}::text, ${checkoutToken}::text, now() + ${CODE_TTL_HOURS} * interval '1 hour'
                FROM candidates c
                WHERE NOT EXISTS (
                    SELECT 1 FROM install_codes ic WHERE ic.code = c.code
                )
                AND NOT EXISTS (SELECT 1 FROM reusable)
                LIMIT 1
                ON CONFLICT (code) DO NOTHING
                RETURNING *
            )
            SELECT *, false AS reused FROM minted
            UNION ALL
            SELECT *, true AS reused FROM reusable
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
            checkoutToken: row.checkout_token,
            createdAt: row.created_at,
            expiresAt: row.expires_at,
            attempts: row.attempts,
            reused: row.reused,
        };
    }

    /**
     * Resolve a code and count the attempt in one round-trip (UPDATE … RETURNING, not
     * read-then-write) so concurrent guesses cannot race past `MAX_RESOLVE_ATTEMPTS`. `null`
     * covers expired, missing and exhausted alike: a distinguishable "exhausted" would leak
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
