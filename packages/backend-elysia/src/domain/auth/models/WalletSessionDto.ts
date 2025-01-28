import { t } from "@backend-utils";
import type { Static } from "elysia";

const EcdsaWalletTokenDto = t.Object({
    address: t.Address(),
    authenticatorId: t.TemplateLiteral([t.Literal("ecdsa-"), t.String()]),
    publicKey: t.Hex(),
    transports: t.Undefined(),
});
const WebAuthNWalletTokenDto = t.Object({
    address: t.Address(),
    authenticatorId: t.String(),
    publicKey: t.Object({
        x: t.Hex(),
        y: t.Hex(),
    }),
    transports: t.Optional(t.Array(t.String())),
});

export const WalletTokenDto = t.Union([
    EcdsaWalletTokenDto,
    WebAuthNWalletTokenDto,
]);

export const WalletAuthResponseDto = t.Intersect([
    t.Object({
        token: t.String(),
        sdkJwt: t.Object({
            token: t.String(),
            expires: t.Number(),
        }),
    }),
    WalletTokenDto,
]);

export const WalletSdkTokenDto = t.Object({
    address: t.Address(),
    scopes: t.Array(t.Literal("interaction")),
    // Some potential additionnal stuff we can put in the webauthn token
    additionalData: t.Optional(
        t.Object({
            // A potential six degrees token if the wallet is routed
            sixDegreesToken: t.Optional(t.String()),
        })
    ),
});

export type StaticWalletSdkTokenDto = Static<typeof WalletSdkTokenDto>;
