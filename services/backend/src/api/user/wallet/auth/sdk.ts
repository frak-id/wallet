import { sessionContext } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia } from "elysia";
import { AuthContext } from "../../../../domain/auth";

export const walletSdkRoutes = new Elysia({ prefix: "/sdk" })
    .use(sessionContext)
    // Generate a new token
    .get(
        "/generate",
        async ({ walletSession }) => {
            return await AuthContext.services.walletSdkSession.generateSdkJwt({
                wallet: walletSession.address,
            });
        },
        {
            withWalletAuthent: true,
            response: {
                401: t.String(),
                200: t.Object({
                    token: t.String(),
                    expires: t.Number(),
                }),
            },
        }
    );
