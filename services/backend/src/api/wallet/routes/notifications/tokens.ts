import { walletSessionContext } from "@backend-common";
import { t } from "@backend-utils";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import {
    notificationContext,
    pushTokensTable,
} from "../../../../domain/notifications";

export const tokensRoutes = new Elysia({ prefix: "/tokens" })
    .use(notificationContext)
    .use(walletSessionContext)
    .put(
        "",
        async ({ body, notification: { db }, walletSession }) => {
            if (!walletSession) return;
            // Insert our push token
            await db
                .insert(pushTokensTable)
                .values({
                    wallet: walletSession.address,
                    endpoint: body.subscription.endpoint,
                    keyP256dh: body.subscription.keys.p256dh,
                    keyAuth: body.subscription.keys.auth,
                    expireAt: body.subscription.expirationTime
                        ? new Date(body.subscription.expirationTime)
                        : null,
                })
                .onConflictDoNothing();
        },
        {
            // Enforce nexus authentication
            authenticated: "wallet",

            // Cleanup expired tokens
            cleanupTokens: true,

            // Body schema
            body: t.Object({
                subscription: t.Object({
                    endpoint: t.String(),
                    keys: t.Object({
                        p256dh: t.String(),
                        auth: t.String(),
                    }),
                    expirationTime: t.Optional(t.Number()),
                }),
            }),
        }
    )
    .delete(
        "",
        async ({ notification: { db }, walletSession }) => {
            if (!walletSession) return;

            // Remove all the push tokens for this wallet
            await db
                .delete(pushTokensTable)
                .where(eq(pushTokensTable.wallet, walletSession.address))
                .execute();
        },
        {
            authenticated: "wallet",
            cleanupTokens: true,
        }
    )
    .get(
        "/hasAny",
        async ({ notification: { db }, walletSession }) => {
            if (!walletSession) return false;

            // Try to find the first push token
            const item = await db.query.pushTokensTable.findFirst({
                where: eq(pushTokensTable.wallet, walletSession.address),
            });
            // Return if we found something
            return !!item;
        },
        {
            authenticated: "wallet",
            response: t.Boolean(),
        }
    );
