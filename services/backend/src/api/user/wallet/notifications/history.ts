import { NotificationContext } from "@backend-domain/notifications";
import { NotificationTypeSchema } from "@backend-domain/notifications/schemas";
import { sessionContext } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia } from "elysia";

export const historyRoutes = new Elysia({ prefix: "/history" })
    .use(sessionContext)
    .get(
        "",
        async ({ walletSession, query }) => {
            const limit = query.limit ?? 20;
            const offset = query.offset ?? 0;

            return NotificationContext.repositories.notificationSent.findByWallet(
                walletSession.address,
                { limit, offset, types: query.type ? [query.type] : undefined }
            );
        },
        {
            withWalletAuthent: true,
            query: t.Object({
                limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
                offset: t.Optional(t.Number({ minimum: 0 })),
                type: t.Optional(NotificationTypeSchema),
            }),
        }
    )
    .put(
        "/:id/opened",
        async ({ walletSession, params }) => {
            const success =
                await NotificationContext.repositories.notificationSent.markOpened(
                    params.id,
                    walletSession.address
                );
            return { success };
        },
        {
            withWalletAuthent: true,
            params: t.Object({
                id: t.String({ format: "uuid" }),
            }),
        }
    );
