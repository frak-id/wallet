import { t } from "@backend-utils";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { pushTokensTable } from "../../db/schema";
import { notificationContext } from "../context";

export const pushTokensRoutes = new Elysia({ prefix: "/pushToken" })
    .use(notificationContext)
    .put(
        "/",
        async ({ body, notificationDb, session }) => {
            if (!session) return;
            // Insert our push token
            await notificationDb
                .insert(pushTokensTable)
                .values({
                    wallet: session.wallet.address,
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
            isNexusAuthenticated: true,

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
        "/",
        async ({ notificationDb, session }) => {
            if (!session) return;

            // Remove all the push tokens for this wallet
            await notificationDb
                .delete(pushTokensTable)
                .where(eq(pushTokensTable.wallet, session.wallet.address))
                .execute();
        },
        {
            isNexusAuthenticated: true,
        }
    )
    .get(
        "/hasAny",
        async ({ notificationDb, session }) => {
            if (!session) return false;

            // Try to find the first push token
            const item = await notificationDb.query.pushTokensTable.findFirst({
                where: eq(pushTokensTable.wallet, session.wallet.address),
            });
            // Return if we found something
            return !!item;
        },
        {
            isNexusAuthenticated: true,
            response: t.Boolean(),
        }
    );
