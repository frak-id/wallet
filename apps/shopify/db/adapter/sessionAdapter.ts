import { Session } from "@shopify/shopify-api";
import type { SessionStorage } from "@shopify/shopify-app-session-storage";
import { log } from "app/services.server/logger";
import {
    desc,
    eq,
    type InferInsertModel,
    type InferSelectModel,
    inArray,
} from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { SessionTable } from "../schema/sessionTable";

export type SessionInput = {
    id: string;
    shop: string;
    state: string;
    isOnline: boolean;
    scope?: string;
    expires?: Date;
    accessToken?: string;
    refreshToken?: string;
    refreshTokenExpires?: Date;
    onlineAccessInfo?: { associated_user: { id: number } };
};

/**
 * Convert a session object to a database row for insertion.
 * Absent fields are `null`, not `undefined`: the upsert's SET skips `undefined`
 * keys, so the library clearing a rejected token would leave it in the row.
 */
export function sessionToRow(
    session: SessionInput
): InferInsertModel<SessionTable> {
    return {
        id: session.id,
        shop: session.shop,
        state: session.state,
        isOnline: session.isOnline,
        scope: session.scope ?? null,
        expires: session.expires ?? null,
        accessToken: session.accessToken ?? null,
        refreshToken: session.refreshToken ?? null,
        refreshTokenExpires: session.refreshTokenExpires ?? null,
        userId: session.onlineAccessInfo?.associated_user.id ?? null,
    };
}

/**
 * A non-expiring offline token: never sent, so `authenticate.admin` sees an
 * inactive session and exchanges it for an expiring pair.
 */
function isNonExpiringOfflineToken(row: InferSelectModel<SessionTable>) {
    return !row.isOnline && !row.expires;
}

/**
 * Convert a database row to session constructor params.
 */
export function rowToSessionParams(
    row: InferSelectModel<SessionTable>
): Record<string, boolean | string | number> {
    const sessionParams: Record<string, boolean | string | number> = {
        id: row.id,
        shop: row.shop,
        state: row.state,
        isOnline: row.isOnline,
    };

    if (row.expires) {
        sessionParams.expires = row.expires.getTime();
    }
    if (row.scope) {
        sessionParams.scope = row.scope;
    }
    if (row.accessToken && !isNonExpiringOfflineToken(row)) {
        sessionParams.accessToken = row.accessToken;
    }
    if (row.refreshToken) {
        sessionParams.refreshToken = row.refreshToken;
    }
    if (row.refreshTokenExpires) {
        sessionParams.refreshTokenExpires = row.refreshTokenExpires.getTime();
    }
    if (row.userId) {
        sessionParams.onlineAccessInfo = row.userId;
    }

    return sessionParams;
}

export class DrizzleSessionStorageAdapter<
    DB extends PostgresJsDatabase<Record<string, unknown>>,
> implements SessionStorage
{
    constructor(
        private readonly db: DB,
        private readonly sessionTable: SessionTable
    ) {}

    public async storeSession(session: Session): Promise<boolean> {
        const row = this.sessionToRow(session);

        await this.db
            .insert(this.sessionTable)
            .values({ ...row })
            .onConflictDoUpdate({
                target: this.sessionTable.id,
                set: { ...row },
            });

        return true;
    }

    public async loadSession(id: string): Promise<Session | undefined> {
        try {
            const row = await this.db
                .select()
                .from(this.sessionTable)
                .where(eq(this.sessionTable.id, id));

            if (!row[0]) {
                return undefined;
            }

            return this.rowToSession(row[0]);
        } catch (error) {
            log.error({ err: error, sessionId: id }, "loadSession failed");

            return undefined;
        }
    }

    public async deleteSession(id: string): Promise<boolean> {
        try {
            await this.db
                .delete(this.sessionTable)
                .where(eq(this.sessionTable.id, id));
        } catch (error) {
            log.error({ err: error, sessionId: id }, "deleteSession failed");

            return false;
        }

        return true;
    }

    public async deleteSessions(ids: string[]): Promise<boolean> {
        try {
            await this.db
                .delete(this.sessionTable)
                .where(inArray(this.sessionTable.id, ids));

            return true;
        } catch (error) {
            log.error({ err: error, sessionIds: ids }, "deleteSessions failed");

            return false;
        }
    }

    public async findSessionsByShop(shop: string): Promise<Session[]> {
        const sessions = await this.db
            .select()
            .from(this.sessionTable)
            .where(eq(this.sessionTable.shop, shop))
            .orderBy(desc(this.sessionTable.expires));

        return sessions.map((session) => this.rowToSession(session));
    }

    private sessionToRow(session: Session): InferInsertModel<SessionTable> {
        return sessionToRow(session);
    }

    private rowToSession(row: InferSelectModel<SessionTable>): Session {
        return Session.fromPropertyArray(
            Object.entries(rowToSessionParams(row))
        );
    }
}
