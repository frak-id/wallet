import { t } from "@backend-utils";

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
