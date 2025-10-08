import { t } from "@backend-utils";
import type { Static } from "elysia";

const WebAuthNWalletTokenDto = t.Object({
    type: t.Optional(t.Literal("webauthn")), // optional since it's the default type
    address: t.Address(),
    authenticatorId: t.String(),
    publicKey: t.Object({
        x: t.Hex(),
        y: t.Hex(),
    }),
    transports: t.Optional(t.Array(t.String())),
});

const EcdsaWalletTokenDto = t.Object({
    type: t.Literal("ecdsa"),
    address: t.Address(),
    authenticatorId: t.TemplateLiteral([t.Literal("ecdsa-"), t.String()]),
    publicKey: t.Hex(),
    transports: t.Undefined(),
});

const DistantWebAuthNWalletTokenDto = t.Object({
    type: t.Literal("distant-webauthn"),
    address: t.Address(),
    authenticatorId: t.String(),
    publicKey: t.Object({
        x: t.Hex(),
        y: t.Hex(),
    }),
    transports: t.Undefined(),
    pairingId: t.String(),
});

export const WalletTokenDto = t.Union([
    EcdsaWalletTokenDto,
    WebAuthNWalletTokenDto,
    DistantWebAuthNWalletTokenDto,
]);

export const WalletAuthResponseDto = t.Composite([
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
            // A potential demo pkey if that a demo wallet
            demoPkey: t.Optional(t.Hex()),
        })
    ),
});

export type StaticWalletTokenDto = Static<typeof WalletTokenDto>;
export type StaticWalletWebauthnTokenDto = Static<
    typeof WebAuthNWalletTokenDto
>;
export type StaticWalletSdkTokenDto = Static<typeof WalletSdkTokenDto>;
