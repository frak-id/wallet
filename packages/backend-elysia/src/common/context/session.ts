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
    );
