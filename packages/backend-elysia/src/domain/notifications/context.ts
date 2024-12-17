import { postgresContext } from "@backend-common";
import { lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { Elysia } from "elysia";
import { pushTokensTable } from "./db/schema";

export const notificationContext = new Elysia({
    name: "Context.notification",
})
    .use(postgresContext)
    .decorate(({ postgresDb, ...decorators }) => {
        const notificationDb = drizzle({
            client: postgresDb,
            schema: { pushTokensTable },
        });
        return {
            ...decorators,
            notificationDb,
            cleanupExpiredTokens: async () => {
                await notificationDb
                    .delete(pushTokensTable)
                    .where(lt(pushTokensTable.expireAt, new Date()))
                    .execute();
            },
        };
    })
    // Macro tyo automatically cleanup expired tokens
    .macro(({ onAfterResponse }) => ({
        cleanupExpiredTokens(isEnabled?: boolean) {
            if (!isEnabled) return;

            return onAfterResponse(async ({ cleanupExpiredTokens }) => {
                await cleanupExpiredTokens();
            });
        },
    }))
    .as("plugin");
