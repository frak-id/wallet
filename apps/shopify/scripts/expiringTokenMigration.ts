import type { Session } from "@shopify/shopify-api";

export type NonExpiringOfflineSession = {
    shop: string;
    accessToken: string;
};

export type MigrationResult =
    | { shop: string; ok: true }
    | { shop: string; ok: false; error: string };

type MigrationDeps = {
    exchange: (session: NonExpiringOfflineSession) => Promise<Session>;
    store: (session: Session) => Promise<unknown>;
};

/**
 * The exchange retires the submitted token, so each new pair is stored before
 * the next shop. A failed store is recovered by rerunning within 7 days:
 * Shopify returns the same pair for the same submitted token.
 */
export async function migrateOfflineSessions(
    sessions: NonExpiringOfflineSession[],
    { exchange, store }: MigrationDeps
): Promise<MigrationResult[]> {
    const results: MigrationResult[] = [];
    for (const session of sessions) {
        try {
            await store(await exchange(session));
            results.push({ shop: session.shop, ok: true });
        } catch (error) {
            results.push({
                shop: session.shop,
                ok: false,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    return results;
}
