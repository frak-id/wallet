import { eq } from "drizzle-orm";
import { db } from "../../../infrastructure/persistence/postgres";
import {
    type InstagramAccessTokenSelect,
    instagramAccessTokensTable,
} from "../db/schema";

export type InstagramAccessTokenSave = Omit<
    InstagramAccessTokenSelect,
    "updatedAt"
>;

export class InstagramAccessTokenRepository {
    async find(account: string): Promise<InstagramAccessTokenSelect | null> {
        const [row] = await db
            .select()
            .from(instagramAccessTokensTable)
            .where(eq(instagramAccessTokensTable.account, account))
            .limit(1);
        return row ?? null;
    }

    async save(row: InstagramAccessTokenSave): Promise<void> {
        const updatedAt = new Date();
        await db
            .insert(instagramAccessTokensTable)
            .values({ ...row, updatedAt })
            .onConflictDoUpdate({
                target: instagramAccessTokensTable.account,
                set: {
                    tokenEncrypted: row.tokenEncrypted,
                    seedHash: row.seedHash,
                    refreshedAt: row.refreshedAt,
                    expiresAt: row.expiresAt,
                    updatedAt,
                },
            });
    }
}
