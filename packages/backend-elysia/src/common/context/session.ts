import { jwt, t } from "@backend-utils";
import { Elysia } from "elysia";
import { Config } from "sst/node/config";

export const sessionContext = new Elysia({
    name: "Context.session",
})
    // Wallet JWT
    .use(
        jwt({
            name: "walletJwt",
            secret: Config.JWT_SECRET,
            schema: t.Object({
                address: t.Address(),
                authenticatorId: t.String(),
                publicKey: t.Object({
                    x: t.Hex(),
                    y: t.Hex(),
                }),
            }),
            // One week
            expirationDelayInSecond: 60 * 60 * 24 * 7,
        })
    )
    // Wallet SDK JWT
    .use(
        jwt({
            name: "walletSdkJwt",
            secret: Config.JWT_SDK_SECRET,
            schema: t.Object({
                wallet: t.Address(),
                scopes: t.Array(t.Literal("interaction")),
            }),
            // One week
            expirationDelayInSecond: 60 * 60 * 24 * 7,
        })
    )
    // Business JWT
    .use(
        jwt({
            name: "businessJwt",
            secret: Config.JWT_SECRET,
            schema: t.Object({
                wallet: t.Address(),
                siweMsg: t.String(),
                siweSignature: t.Hex(),
            }),
            // One week
            expirationDelayInSecond: 60 * 60 * 24 * 7,
        })
    )
    // Then some helpers for potential cookies / headers
    .guard({
        cookie: t.Object({
            walletAuth: t.Optional(t.String()),
            businessAuth: t.Optional(t.String()),
        }),
        // headers: t.Partial(t.Object({
        //     "x-wallet-sdk-auth": t.String(),
        // })),
    })
    .macro(({ onBeforeHandle }) => ({
        authenticated(target?: true | "wallet" | "business" | "wallet-sdk") {
            if (!target) return;

            switch (target) {
                // Business casse
                case "business":
                    return onBeforeHandle(
                        async ({
                            cookie: { businessAuth },
                            error,
                            businessJwt,
                        }) => {
                            if (!businessAuth) {
                                return error(
                                    "Unauthorized",
                                    "Missing business JWT"
                                );
                            }
                            const auth = await businessJwt.verify(
                                businessAuth.value
                            );
                            if (!auth) {
                                return error(
                                    "Unauthorized",
                                    "Invalid business JWT"
                                );
                            }
                            if (auth.exp && auth.exp < Date.now() / 1000) {
                                return error(
                                    "Unauthorized",
                                    "Expired business JWT"
                                );
                            }
                        }
                    );
                // Wallet SDK case
                case "wallet-sdk":
                    return onBeforeHandle(
                        async ({
                            headers: { "x-wallet-sdk-auth": walletSdkAuth },
                            error,
                            walletSdkJwt,
                        }) => {
                            if (!walletSdkAuth) {
                                return error(
                                    "Unauthorized",
                                    "Missing wallet SDK JWT"
                                );
                            }
                            const auth =
                                await walletSdkJwt.verify(walletSdkAuth);
                            if (!auth) {
                                return error(
                                    "Unauthorized",
                                    "Invalid wallet SDK JWT"
                                );
                            }
                            if (auth.exp && auth.exp < Date.now() / 1000) {
                                return error(
                                    "Unauthorized",
                                    "Expired wallet SDK JWT"
                                );
                            }
                        }
                    );
                // True or "wallet" case
                default:
                    return onBeforeHandle(
                        async ({
                            cookie: { walletAuth },
                            error,
                            walletJwt,
                        }) => {
                            if (!walletAuth) {
                                return error(401, "Missing wallet JWT");
                            }
                            const auth = await walletJwt.verify(
                                walletAuth.value
                            );
                            if (!auth) {
                                return error(401, "Invalid wallet JWT");
                            }
                            if (auth.exp && auth.exp < Date.now() / 1000) {
                                return error(
                                    "Unauthorized",
                                    "Expired wallet JWT"
                                );
                            }
                        }
                    );
            }
        },
    }))
    .as("plugin");

export const walletSessionContext = new Elysia({
    name: "Context.walletSession",
})
    .use(sessionContext)
    .guard({
        cookie: t.Object({
            walletAuth: t.Optional(t.String()),
        }),
    })
    .resolve(async ({ cookie: { walletAuth }, walletJwt }) => {
        return {
            walletSession: await walletJwt.verify(walletAuth.value),
        };
    })
    .as("plugin");
