import { generateCode, isUniqueViolation } from "@backend-utils";
import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "../../../infrastructure/persistence/postgres";
import {
    type InstagramDeclarationSelect,
    instagramPendingLinksTable,
} from "../db/schema";
import { toDeclarationRow } from "../utils";

const MINT_ATTEMPTS = 5;
const table = instagramPendingLinksTable;

/** Typed handles and certification codes, one row per identity group not yet certified. */
export class InstagramPendingLinkRepository {
    async findDeclaration(
        identityGroupId: string
    ): Promise<InstagramDeclarationSelect | null> {
        const [row] = await db
            .select()
            .from(table)
            .where(
                and(
                    eq(table.identityGroupId, identityGroupId),
                    isNotNull(table.username)
                )
            )
            .limit(1);
        return row ? toDeclarationRow(row) : null;
    }

    async findDeclarations(
        identityGroupIds: string[]
    ): Promise<InstagramDeclarationSelect[]> {
        if (identityGroupIds.length === 0) return [];
        const rows = await db
            .select()
            .from(table)
            .where(
                and(
                    inArray(table.identityGroupId, identityGroupIds),
                    isNotNull(table.username)
                )
            );
        return rows.flatMap((row) => toDeclarationRow(row) ?? []);
    }

    async declare(params: {
        identityGroupId: string;
        username: string;
    }): Promise<InstagramDeclarationSelect> {
        const declaredAt = new Date();
        const [saved] = await db
            .insert(table)
            .values({ ...params, declaredAt })
            .onConflictDoUpdate({
                target: table.identityGroupId,
                set: { username: params.username, declaredAt },
            })
            .returning();
        const declaration = saved && toDeclarationRow(saved);
        if (!declaration) {
            throw new Error(
                `Failed to save the Instagram declaration of ${params.identityGroupId}`
            );
        }
        return declaration;
    }

    /** Drops the handle; the row goes too unless it still holds a code. */
    async undeclare(identityGroupId: string): Promise<void> {
        await db
            .delete(table)
            .where(
                and(
                    eq(table.identityGroupId, identityGroupId),
                    isNull(table.code)
                )
            );
        await db
            .update(table)
            .set({ username: null, declaredAt: null })
            .where(eq(table.identityGroupId, identityGroupId));
    }

    /** The group's unused code, minted on first ask: a code already copied keeps working. */
    async getOrCreateCode(identityGroupId: string): Promise<string> {
        for (let attempt = 0; attempt < MINT_ATTEMPTS; attempt++) {
            try {
                const [row] = await db
                    .insert(table)
                    .values({ identityGroupId, code: generateCode() })
                    .onConflictDoUpdate({
                        target: table.identityGroupId,
                        set: {
                            code: sql`coalesce(${table.code}, excluded.code)`,
                        },
                    })
                    .returning({ code: table.code });
                if (row?.code) return row.code;
            } catch (error) {
                // Another group drew the same code: draw again.
                if (!isUniqueViolation(error)) throw error;
            }
        }
        throw new Error(
            `Failed to mint an Instagram link code for ${identityGroupId}`
        );
    }

    async findByCodes(
        codes: string[]
    ): Promise<{ identityGroupId: string; code: string }[]> {
        if (codes.length === 0) return [];
        const rows = await db
            .select({
                identityGroupId: table.identityGroupId,
                code: table.code,
            })
            .from(table)
            .where(inArray(table.code, codes));
        return rows.flatMap(({ identityGroupId, code }) =>
            code ? [{ identityGroupId, code }] : []
        );
    }
}
