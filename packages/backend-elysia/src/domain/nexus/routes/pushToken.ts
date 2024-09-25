import { t } from "@backend-utils";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { nexusContext } from "../context";
import { pushTokensTable } from "../db/schema";

export const pushTokenRoutes = new Elysia({ prefix: "pushToken" })
    .use(nexusContext)
    .post(
        "/save",
        async ({ body, nexusDb, session, error }) => {
            if (!session) {
                return error(401);
            }
            // Insert our push token
            await nexusDb
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
    .post("/unsubscribe", async ({ nexusDb, session }) => {
        if (!session) {
            return false;
        }

        // Remove all the push tokens for this wallet
        await nexusDb
            .delete(pushTokensTable)
            .where(eq(pushTokensTable.wallet, session.wallet.address))
            .execute();
    })
    .get(
        "/hasAny",
        async ({ nexusDb, session }) => {
            if (!session) {
                return false;
            }
            // Try to find the first push token
            const item = await nexusDb.query.pushTokensTable.findFirst({
                where: eq(pushTokensTable.wallet, session.wallet.address),
            });
            // Return if we found something
            return !!item;
        },
        {
            response: t.Boolean(),
        }
    );
