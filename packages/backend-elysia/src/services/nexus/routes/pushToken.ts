import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import type { Address } from "viem";
import { authNexusUser } from "../context";
import { pushTokens } from "../db/schema";

export const pushTokenRoutes = new Elysia({ prefix: "pushToken" })
    .use(authNexusUser)
    .post(
        "/save",
        async ({ body, nexusDb, session }) => {
            if (!session) {
                throw new Error("No session found");
            }
            // Insert our push token
            await nexusDb
                .insert(pushTokens)
                .values({
                    wallet: session.wallet.address as Address,
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
            .delete(pushTokens)
            .where(eq(pushTokens.wallet, session.wallet.address))
            .execute();
    })
    .get(
        "/hasAny",
        async ({ nexusDb, session }) => {
            if (!session) {
                return false;
            }
            // Try to find the first push token
            const item = await nexusDb.query.pushTokens.findFirst({
                where: eq(pushTokens.wallet, session.wallet.address),
            });
            // Return if we found something
            return !!item;
        },
        {
            response: t.Boolean(),
        }
    );
