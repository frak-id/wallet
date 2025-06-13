import { postgresDb } from "@backend-common";
import { type PostgresJsDatabase, drizzle } from "drizzle-orm/postgres-js";
import { Elysia } from "elysia";
import { pushTokensTable } from "./db/schema";
import { NotificationsService } from "./services/NotificationsService";

export const notificationContext = new Elysia({
    name: "Context.notification",
})
    .decorate((decorators) => {
        const notificationDb = drizzle({
            client: postgresDb,
            schema: { pushTokensTable },
        });
        return {
            ...decorators,
            notifications: {
                db: notificationDb,
                services: {
                    notifications: new NotificationsService(notificationDb),
                },
            },
        };
    })
    // Macro to automatically cleanup expired tokens
    .macro({
        cleanupTokens(isEnabled?: boolean) {
            if (!isEnabled) return;

            return {
                afterResponse: async ({ notifications: { services } }) => {
                    await services.notifications.cleanupExpiredTokens();
                },
            };
        },
    })
    .as("scoped");

export type NotificationDb = PostgresJsDatabase<{
    pushTokensTable: typeof pushTokensTable;
}>;
