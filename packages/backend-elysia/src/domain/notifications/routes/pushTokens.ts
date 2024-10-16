import { walletSessionContext } from "@backend-common";
import { t } from "@backend-utils";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { notificationContext } from "../context";
import { pushTokensTable } from "../db/schema";

export const pushTokensRoutes = new Elysia({ prefix: "/pushToken" })
    .use(notificationContext)
    .use(walletSessionContext)
    .put(
        "",
        async ({ body, notificationDb, walletSession }) => {
            if (!walletSession) return;
            // Insert our push token
            await notificationDb
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
            cleanupExpiredTokens: true,

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
        async ({ notificationDb, walletSession }) => {
            if (!walletSession) return;

            // Remove all the push tokens for this wallet
            await notificationDb
                .delete(pushTokensTable)
                .where(eq(pushTokensTable.wallet, walletSession.address))
                .execute();
        },
        {
            authenticated: "wallet",
            cleanupExpiredTokens: true,
        }
    )
    .get(
        "/hasAny",
        async ({ notificationDb, walletSession }) => {
            if (!walletSession) return false;

            // Try to find the first push token
            const item = await notificationDb.query.pushTokensTable.findFirst({
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
