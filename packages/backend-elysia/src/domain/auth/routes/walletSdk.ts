import { walletSdkSessionContext, walletSessionContext } from "@backend-common";
import { t } from "@backend-utils";
import { Elysia } from "elysia";

export const walletSdkAuthRoutes = new Elysia({ prefix: "/walletSdk" })
    .use(walletSessionContext)
    // Generate a new token
    .get(
        "/generate",
        async ({ walletSession, walletSdkJwt, error }) => {
            if (!walletSession) {
                return error(401, "Unauthorized");
            }

            const jwtToken = await walletSdkJwt.sign({
                // Global payload
                address: walletSession.address,
                scopes: ["interaction"],
                // Some JWT specific infos
                sub: walletSession.address,
                iat: Date.now(),
            });

            return {
                token: jwtToken,
                // Tell when the token expires
                expires: Date.now() + 60_000 * 60 * 24 * 7,
            };
        },
        {
            authenticated: "wallet",
            response: {
                401: t.String(),
                200: t.Object({
                    token: t.String(),
                    expires: t.Number(),
                }),
            },
        }
    )
    .use(walletSdkSessionContext)
    .get(
        "/isValid",
        async ({ walletSdkSession }) => {
            if (!walletSdkSession) {
                return {
                    isValid: false,
                };
            }

            // Else check the expiration date if any
            const exp = walletSdkSession.exp;
            if (exp && exp < Date.now() / 1000) {
                return {
                    isValid: false,
                };
            }

            // Otherwise all good
            return {
                isValid: true,
            };
        },
        {
            response: {
                401: t.String(),
                200: t.Object({
                    isValid: t.Boolean(),
                }),
            },
        }
    );
