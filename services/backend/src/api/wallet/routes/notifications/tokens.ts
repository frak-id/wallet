import { db, sessionContext } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import {
    notificationMacro,
    pushTokensTable,
} from "../../../../domain/notifications";

export const tokensRoutes = new Elysia({ prefix: "/tokens" })
    .use(notificationMacro)
    .use(sessionContext)
    .put(
        "",
        async ({ body, walletSession }) => {
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
            // Enforce wallet authentication
            withWalletAuthent: true,

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
        async ({ walletSession }) => {
            // Remove all the push tokens for this wallet
            await db
                .delete(pushTokensTable)
                .where(eq(pushTokensTable.wallet, walletSession.address))
                .execute();
        },
        {
            withWalletAuthent: true,
            cleanupTokens: true,
        }
    )
    .get(
        "/hasAny",
        async ({ walletSession }) => {
            // Try to find the first push token
            const item = await db.query.pushTokensTable.findFirst({
                where: eq(pushTokensTable.wallet, walletSession.address),
            });
            // Return if we found something
            return !!item;
        },
        {
            withWalletAuthent: true,
            response: t.Boolean(),
        }
    );
