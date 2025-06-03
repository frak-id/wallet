import { jwt } from "@backend-utils";
import { isRunningLocally } from "@frak-labs/app-essentials";
import { Elysia, error } from "elysia";
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
    .macro({
        authenticated(target?: true | "wallet" | "wallet-sdk") {
            if (!target) return;

            // Wallet SDK case
            if (target === "wallet-sdk") {
                return {
                    beforeHandle: async ({
                        headers: { "x-wallet-sdk-auth": walletSdkAuth },
                        walletSdkJwt,
                    }) => {
                        if (!walletSdkAuth) {
                            return error(
                                "Unauthorized",
                                "Missing wallet SDK JWT"
                            );
                        }
                        const auth = await walletSdkJwt.verify(walletSdkAuth);
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
                    walletJwt,
                }) => {
                    if (!walletAuth) {
                        return error(401, "Missing wallet JWT");
                    }
                    const auth = await walletJwt.verify(walletAuth);
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
