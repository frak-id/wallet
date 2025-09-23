import { Elysia } from "elysia";
import { NotificationContext } from "./context";

export const notificationMacro = new Elysia({
    name: "Macro.notification",
})
    // Macro to automatically cleanup expired tokens
    .macro({
        cleanupTokens(isEnabled?: boolean) {
            if (!isEnabled) return;

            return {
                afterResponse: async () => {
                    await NotificationContext.services.notifications.cleanupExpiredTokens();
                },
            };
        },
    })
    .as("scoped");
