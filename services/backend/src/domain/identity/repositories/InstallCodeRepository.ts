import { randomInt } from "node:crypto";
import { db, log } from "@backend-infrastructure";
import { and, eq, gt, lt } from "drizzle-orm";
import { installCodesTable } from "../db/schema";

// Excludes ambiguous characters: 0/O, 1/I/L
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
const CODE_TTL_HOURS = 72;
const MAX_CODE_GENERATION_ATTEMPTS = 5;

type InstallCodeSelect = typeof installCodesTable.$inferSelect;

function generateRandomCode(): string {
    let code = "";
    for (let i = 0; i < CODE_LENGTH; i++) {
        code += CODE_CHARS[randomInt(CODE_CHARS.length)];
    }
    return code;
}

export class InstallCodeRepository {
    async create(params: {
        merchantId: string;
        anonymousId: string;
    }): Promise<InstallCodeSelect> {
        const { merchantId, anonymousId } = params;

        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + CODE_TTL_HOURS);

        for (
            let attempt = 0;
            attempt < MAX_CODE_GENERATION_ATTEMPTS;
            attempt++
        ) {
            const code = generateRandomCode();
            try {
                const [result] = await db
                    .insert(installCodesTable)
                    .values({
                        code,
                        merchantId,
                        anonymousId,
                        expiresAt,
                    })
                    .returning();

                if (result) {
                    return result;
                }
            } catch (err: unknown) {
                const isUniqueViolation =
                    err instanceof Error &&
                    "code" in err &&
                    (err as { code: string }).code === "23505";
                if (isUniqueViolation) {
                    log.debug(
                        { attempt, code },
                        "Install code collision, retrying"
                    );
                    continue;
                }
                throw err;
            }
        }

        throw new Error(
            "Failed to generate unique install code after max attempts"
        );
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

    async consumeByCode<T>(
        code: string,
        onConsume: (installCode: InstallCodeSelect) => Promise<T>
    ): Promise<{ installCode: InstallCodeSelect; result: T } | null> {
        return db.transaction(async (trx) => {
            const [locked] = await trx
                .select()
                .from(installCodesTable)
                .where(
                    and(
                        eq(installCodesTable.code, code.toUpperCase()),
                        gt(installCodesTable.expiresAt, new Date())
                    )
                )
                .for("update");

            if (!locked) {
                return null;
            }

            const result = await onConsume(locked);

            await trx
                .delete(installCodesTable)
                .where(eq(installCodesTable.id, locked.id));

            return { installCode: locked, result };
        });
    }

    async deleteExpired(): Promise<void> {
        await db
            .delete(installCodesTable)
            .where(lt(installCodesTable.expiresAt, new Date()));
    }
}
