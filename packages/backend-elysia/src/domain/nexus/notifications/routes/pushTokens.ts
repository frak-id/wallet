import { nextSessionContext } from "@backend-common";
import { t } from "@backend-utils";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { pushTokensTable } from "../../db/schema";
import { notificationContext } from "../context";

export const pushTokensRoutes = new Elysia({ prefix: "/pushToken" })
    .use(notificationContext)
    .use(nextSessionContext)
    .put(
        "",
        async ({ body, notificationDb, nexusSession }) => {
            if (!nexusSession) return;
            // Insert our push token
            await notificationDb
                .insert(pushTokensTable)
                .values({
                    wallet: nexusSession.wallet.address,
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
            isAuthenticated: "nexus",

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
        async ({ notificationDb, nexusSession }) => {
            if (!nexusSession) return;

            // Remove all the push tokens for this wallet
            await notificationDb
                .delete(pushTokensTable)
                .where(eq(pushTokensTable.wallet, nexusSession.wallet.address))
                .execute();
        },
        { isAuthenticated: "nexus" }
    )
    .get(
        "/hasAny",
        async ({ notificationDb, nexusSession }) => {
            if (!nexusSession) return false;

            // Try to find the first push token
            const item = await notificationDb.query.pushTokensTable.findFirst({
                where: eq(pushTokensTable.wallet, nexusSession.wallet.address),
            });
            // Return if we found something
            return !!item;
        },
        {
            isAuthenticated: "nexus",
            response: t.Boolean(),
        }
    );
