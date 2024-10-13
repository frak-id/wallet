import { nextSessionContext, sessionContext } from "@backend-common";
import { t } from "@backend-utils";
import { Elysia } from "elysia";

export const walletSdkAuthRoutes = new Elysia({ prefix: "/walletSdk" })
    .use(nextSessionContext)
    .use(sessionContext)
    // todo: wallet auth endpoint
    .get(
        "/generate",
        async ({ walletSession, walletSdkJwt, error }) => {
            if (!walletSession) {
                return error(401, "Unauthorized");
            }

            const jwtToken = await walletSdkJwt.sign({
                // Global payload
                wallet: walletSession.wallet.address,
                scopes: ["interaction"],
                // Some JWT specific infos
                iss: "frak.id",
                sub: walletSession.wallet.address,
                iat: Date.now(),
                // Expire in 7 days
                exp: Date.now() + 60_000 * 60 * 24 * 7,
            });

            return { token: jwtToken };
        },
        {
            response: {
                401: t.String(),
                200: t.Object({
                    token: t.String(),
                }),
            },
        }
    );
