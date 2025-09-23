import { JwtContext } from "@backend-common";
import { isRunningLocally } from "@frak-labs/app-essentials";
import { Elysia, error } from "elysia";

/**
 * Some default auth cookies props
 */
const defaultCookiesProps = {
    domain: isRunningLocally ? "localhost" : ".frak.id",
    sameSite: "none",
    maxAge: 60 * 60 * 24 * 7, // 1 week
    secure: true,
} as const;

export const sessionContext = new Elysia({
    name: "Macro.session",
    cookie: defaultCookiesProps,
})
    .macro({
        authenticated(target?: true | "wallet" | "wallet-sdk") {
            if (!target) return;

            // Wallet SDK case
            if (target === "wallet-sdk") {
                return {
                    beforeHandle: async ({
                        headers: { "x-wallet-sdk-auth": walletSdkAuth },
                    }) => {
                        if (!walletSdkAuth) {
                            return error(
                                "Unauthorized",
                                "Missing wallet SDK JWT"
                            );
                        }
                        const auth =
                            await JwtContext.walletSdk.verify(walletSdkAuth);
                        if (!auth) {
                            return error(
                                "Unauthorized",
                                "Invalid wallet SDK JWT"
                            );
                        }
                    },
                };
            }

            // True or "wallet" case
            return {
                beforeHandle: async ({
                    headers: { "x-wallet-auth": walletAuth },
                }) => {
                    if (!walletAuth) {
                        return error(401, "Missing wallet JWT");
                    }
                    const auth = await JwtContext.wallet.verify(walletAuth);
                    // Throw an error and remove the token
                    if (!auth) {
                        return error(401, "Invalid wallet JWT");
                    }
                },
            };
        },
    })
    .as("scoped");

export const walletSessionContext = new Elysia({
    name: "Macro.walletSession",
})
    .use(sessionContext)
    .resolve(async ({ headers: { "x-wallet-auth": walletAuth } }) => {
        if (!walletAuth) return {};
        return {
            walletSession: await JwtContext.wallet.verify(walletAuth),
        };
    })
    .as("scoped");

export const walletSdkSessionContext = new Elysia({
    name: "Macro.walletSdkSession",
})
    .use(sessionContext)
    .resolve(async ({ headers: { "x-wallet-sdk-auth": walletSdkAuth } }) => {
        return {
            walletSdkSession: await JwtContext.walletSdk.verify(walletSdkAuth),
        };
    })
    .as("scoped");
