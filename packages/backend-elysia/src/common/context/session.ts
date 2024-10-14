import { jwt, t } from "@backend-utils";
import { isRunningLocally } from "@frak-labs/app-essentials";
import { Elysia } from "elysia";
import { Config } from "sst/node/config";

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
    name: "Context.session",
    cookie: defaultCookiesProps,
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
            // Default jwt payload
            iss: "frak.id",
        })
    )
    // Wallet SDK JWT
    .use(
        jwt({
            name: "walletSdkJwt",
            secret: Config.JWT_SDK_SECRET,
            schema: t.Object({
                address: t.Address(),
                scopes: t.Array(t.Literal("interaction")),
            }),
            // One week
            expirationDelayInSecond: 60 * 60 * 24 * 7,
            // Default jwt payload
            iss: "frak.id",
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
            // Default jwt payload
            iss: "frak.id",
        })
    )
    // Then some helpers for potential cookies / headers
    .guard({
        cookie: t.Object({
            walletAuth: t.Optional(t.String()),
            businessAuth: t.Optional(t.String()),
        }),
    })
    .onBeforeHandle(({ cookie: { walletAuth, businessAuth } }) => {
        // Set default properties for walletAuth cookie
        walletAuth.update(defaultCookiesProps);
        // Set default properties for businessAuth cookie
        businessAuth.update(defaultCookiesProps);
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
                            if (!businessAuth?.value) {
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
                            if (!walletAuth?.value) {
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
        const value = walletAuth?.value;
        if (!value) return {};
        return {
            walletSession: await walletJwt.verify(value),
        };
    })
    .as("plugin");

export const walletSdkSessionContext = new Elysia({
    name: "Context.walletSdkSession",
})
    .use(sessionContext)
    .guard({
        headers: t.Partial(
            t.Object({
                "x-wallet-sdk-auth": t.String(),
            })
        ),
    })
    .resolve(
        async ({
            headers: { "x-wallet-sdk-auth": walletSdkAuth },
            walletSdkJwt,
        }) => {
            return {
                walletSdkSession: await walletSdkJwt.verify(walletSdkAuth),
            };
        }
    )
    .as("plugin");
