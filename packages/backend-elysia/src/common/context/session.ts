import { t } from "@backend-utils";
import { jwt } from "@elysiajs/jwt";
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
                                error("Unauthorized", "Missing business JWT");
                            }
                            const auth = await businessJwt.verify(
                                businessAuth.value
                            );
                            if (!auth) {
                                error("Unauthorized", "Invalid business JWT");
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
                                error("Unauthorized", "Missing wallet SDK JWT");
                            }
                            const auth =
                                await walletSdkJwt.verify(walletSdkAuth);
                            if (!auth) {
                                error("Unauthorized", "Invalid wallet SDK JWT");
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
                        }
                    );
            }
        },
    }))
    .as("plugin");
