import { Elysia } from "elysia";
import { NotificationsService } from "./services/NotificationsService";

export const notificationContext = new Elysia({
    name: "Context.notification",
})
    .decorate((decorators) => {
        return {
            ...decorators,
            notifications: {
                services: {
                    notifications: new NotificationsService(),
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
