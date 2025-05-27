import { jwt, t } from "@backend-utils";
import { isRunningLocally } from "@frak-labs/app-essentials";
import { Elysia, status } from "elysia";
import {
    WalletSdkTokenDto,
    WalletTokenDto,
} from "../../domain/auth/models/WalletSessionDto";

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
            secret: process.env.JWT_SECRET as string,
            schema: WalletTokenDto,
            // Default jwt payload
            iss: "frak.id",
        })
    )
    // Wallet SDK JWT
    .use(
        jwt({
            name: "walletSdkJwt",
            secret: process.env.JWT_SDK_SECRET as string,
            schema: WalletSdkTokenDto,
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
            secret: process.env.JWT_SECRET as string,
            schema: t.Object({
                wallet: t.Address(),
                siweMsg: t.String(),
                siweSignature: t.Hex(),
            }),
            // Default jwt payload
            iss: "frak.id",
        })
    )
    // Then some helpers for potential cookies / headers
    .guard({
        cookie: t.Object({
            businessAuth: t.Optional(t.String()),
        }),
    })
    .onBeforeHandle(({ cookie: { businessAuth } }) => {
        // Set default properties for businessAuth cookie
        businessAuth.update(defaultCookiesProps);
    })
    .macro({
        authenticated(target?: true | "wallet" | "business" | "wallet-sdk") {
            if (!target) return;

            // Business case
            if (target === "business") {
                return {
                    beforeHandle: async ({
                        cookie: { businessAuth },
                        businessJwt,
                    }) => {
                        if (!businessAuth?.value) {
                            return status(
                                "Unauthorized",
                                "Missing business JWT"
                            );
                        }
                        const auth = await businessJwt.verify(
                            businessAuth.value
                        );
                        // Throw an error and remove the token
                        if (!auth) {
                            businessAuth.update({
                                value: "",
                                maxAge: 0,
                            });
                            return status(
                                "Unauthorized",
                                "Invalid business JWT"
                            );
                        }
                    },
                };
            }

            // Wallet SDK case
            if (target === "wallet-sdk") {
                return {
                    beforeHandle: async ({
                        headers: { "x-wallet-sdk-auth": walletSdkAuth },
                        walletSdkJwt,
                    }) => {
                        if (!walletSdkAuth) {
                            return status(
                                "Unauthorized",
                                "Missing wallet SDK JWT"
                            );
                        }
                        const auth = await walletSdkJwt.verify(walletSdkAuth);
                        if (!auth) {
                            status;
                            return status(
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
                    walletJwt,
                }) => {
                    if (!walletAuth) {
                        return status(401, "Missing wallet JWT");
                    }
                    const auth = await walletJwt.verify(walletAuth);
                    // Throw an error and remove the token
                    if (!auth) {
                        return status(401, "Invalid wallet JWT");
                    }
                },
            };
        },
    })
    .as("scoped");

export const walletSessionContext = new Elysia({
    name: "Context.walletSession",
})
    .use(sessionContext)
    .resolve(
        async ({ headers: { "x-wallet-auth": walletAuth }, walletJwt }) => {
            if (!walletAuth) return {};
            return {
                walletSession: await walletJwt.verify(walletAuth),
            };
        }
    )
    .as("scoped");

export const walletSdkSessionContext = new Elysia({
    name: "Context.walletSdkSession",
})
    .use(sessionContext)
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
    .as("scoped");
