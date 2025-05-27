import { postgresContext } from "@backend-common";
import { type PostgresJsDatabase, drizzle } from "drizzle-orm/postgres-js";
import { Elysia } from "elysia";
import { pushTokensTable } from "./db/schema";
import { NotificationsService } from "./services/NotificationsService";

export const notificationContext = new Elysia({
    name: "Context.notification",
})
    .use(postgresContext)
    .decorate(({ postgresDb, ...decorators }) => {
        const notificationDb = drizzle({
            client: postgresDb,
            schema: { pushTokensTable },
        });

        const notificationsService = new NotificationsService(notificationDb);
        return {
            ...decorators,
            notification: {
                service: notificationsService,
                db: notificationDb,
            },
        };
    })
    // Macro to automatically cleanup expired tokens
    .macro({
        cleanupTokens(isEnabled?: boolean) {
            if (!isEnabled) return;

            return {
                afterResponse: async ({ notification: { service } }) => {
                    await service.cleanupExpiredTokens();
                },
            };
        },
    })
    .as("scoped");

export type NotificationDb = PostgresJsDatabase<{
    pushTokensTable: typeof pushTokensTable;
}>;
