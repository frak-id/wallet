import { sessionContext } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia } from "elysia";
import { NotificationContext } from "../../../../domain/notifications";

export const historyRoutes = new Elysia({ prefix: "/history" })
    .use(sessionContext)
    .get(
        "",
        async ({ walletSession, query }) => {
            const limit = query.limit ?? 20;
            const offset = query.offset ?? 0;
            const types = query.types
                ? (query.types.split(",") as Array<
                      "promotional" | "reward_pending" | "reward_settled"
                  >)
                : undefined;

            return NotificationContext.repositories.notificationSent.findByWallet(
                walletSession.address,
                { limit, offset, types }
            );
        },
        {
            withWalletAuthent: true,
            query: t.Object({
                limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
                offset: t.Optional(t.Number({ minimum: 0 })),
                types: t.Optional(t.String()),
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
