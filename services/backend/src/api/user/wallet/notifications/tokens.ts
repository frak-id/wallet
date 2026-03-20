import { db, sessionContext } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import {
    notificationMacro,
    type PushTokenType,
    pushTokensTable,
} from "../../../../domain/notifications";
import { RegisterTokenBodySchema } from "../../../schemas";

function tokenValuesFromBody(
    body: typeof RegisterTokenBodySchema.static,
    wallet: `0x${string}`
) {
    if (body.type === "fcm") {
        return {
            wallet,
            type: "fcm" as PushTokenType,
            endpoint: body.token,
            keyP256dh: null,
            keyAuth: null,
        };
    }

    return {
        wallet,
        type: "web-push" as PushTokenType,
        endpoint: body.subscription.endpoint,
        keyP256dh: body.subscription.keys.p256dh,
        keyAuth: body.subscription.keys.auth,
        expireAt: body.subscription.expirationTime
            ? new Date(body.subscription.expirationTime)
            : null,
    };
}

export const tokensRoutes = new Elysia({ prefix: "/tokens" })
    .use(notificationMacro)
    .use(sessionContext)
    .put(
        "",
        async ({ body, walletSession }) => {
            const values = tokenValuesFromBody(body, walletSession.address);
            await db
                .insert(pushTokensTable)
                .values(values)
                .onConflictDoNothing();
        },
        {
            withWalletAuthent: true,
            cleanupTokens: true,
            body: RegisterTokenBodySchema,
        }
    )
    .delete(
        "",
        async ({ walletSession }) => {
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
            const item = await db.query.pushTokensTable.findFirst({
                where: eq(pushTokensTable.wallet, walletSession.address),
            });
            return !!item;
        },
        {
            withWalletAuthent: true,
            response: t.Boolean(),
        }
    );
