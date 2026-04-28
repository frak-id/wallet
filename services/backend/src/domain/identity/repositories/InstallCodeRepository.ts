import { db } from "@backend-infrastructure";
import { CANDIDATE_BATCH_SIZE, generateCandidates } from "@backend-utils";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { installCodesTable } from "../db/schema";

const CODE_TTL_HOURS = 72;

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
        };
    }

    async findByCode(code: string): Promise<InstallCodeSelect | null> {
        const result = await db.query.installCodesTable.findFirst({
            where: and(
                eq(installCodesTable.code, code.toUpperCase()),
                gt(installCodesTable.expiresAt, new Date())
            ),
        });
        return result ?? null;
    }

    async deleteExpired(): Promise<number> {
        const result = await db
            .delete(installCodesTable)
            .where(lt(installCodesTable.expiresAt, new Date()));
        return result.length;
    }
}
