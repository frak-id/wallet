import { HttpResponseError, type Session } from "@shopify/shopify-api";

export type NonExpiringOfflineSession = {
    id: string;
    shop: string;
    accessToken: string;
};

/**
 * `unsaved`: exchanged but not stored, recoverable by a rerun within 7 days.
 * `dead`: Shopify refused the token itself. `failed`: anything else, safe to rerun.
 */
export type MigrationResult =
    | { shop: string; status: "migrated" | "cleared" }
    | { shop: string; status: "dead" | "failed" | "unsaved"; error: string };

type MigrationDeps = {
    exchange: (session: NonExpiringOfflineSession) => Promise<Session>;
    store: (session: Session) => Promise<unknown>;
    clear?: (session: NonExpiringOfflineSession) => Promise<unknown>;
};

function isDeadToken(error: unknown) {
    return (
        error instanceof HttpResponseError &&
        error.response.code === 400 &&
        error.response.body?.error === "invalid_subject_token"
    );
}

function describeError(error: unknown): string {
    if (error instanceof HttpResponseError) {
        const code = error.response.body?.error;
        return `${error.response.code} ${typeof code === "string" ? code : error.response.statusText}`;
    }
    return error instanceof Error ? error.message : String(error);
}

async function clearDeadSession(
    session: NonExpiringOfflineSession,
    clear: NonNullable<MigrationDeps["clear"]>
): Promise<MigrationResult> {
    try {
        await clear(session);
        return { shop: session.shop, status: "cleared" };
    } catch (error) {
        return {
            shop: session.shop,
            status: "dead",
            error: `clear failed: ${describeError(error)}`,
        };
    }
}

async function migrateOne(
    session: NonExpiringOfflineSession,
    { exchange, store, clear }: MigrationDeps
): Promise<MigrationResult> {
    const { shop } = session;
    let exchanged: Session;
    try {
        exchanged = await exchange(session);
    } catch (error) {
        if (!isDeadToken(error)) {
            return { shop, status: "failed", error: describeError(error) };
        }
        if (!clear) {
            return { shop, status: "dead", error: describeError(error) };
        }
        return clearDeadSession(session, clear);
    }
    try {
        await store(exchanged);
        return { shop, status: "migrated" };
    } catch (error) {
        return { shop, status: "unsaved", error: describeError(error) };
    }
}

/** One shop at a time: the exchange retires the submitted token, so each pair is stored before the next. */
export async function migrateOfflineSessions(
    sessions: NonExpiringOfflineSession[],
    deps: MigrationDeps
): Promise<MigrationResult[]> {
    const results: MigrationResult[] = [];
    for (const session of sessions) {
        results.push(await migrateOne(session, deps));
    }
    return results;
}
