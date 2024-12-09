import { t } from "@backend-utils";

const PrivyWalletTokenDto = t.Object({
    address: t.Address(),
    authenticatorId: t.TemplateLiteral([t.Literal("privy-"), t.String()]),
    publicKey: t.Hex(),
    transports: t.Undefined(),
});
export const WebAuthNWalletTokenDto = t.Object({
    address: t.Address(),
    authenticatorId: t.String(), // 'Privy' in case of fallback authentication
    publicKey: t.Object({
        x: t.Hex(),
        y: t.Hex(),
    }),
    transports: t.Optional(t.Array(t.String())),
});
export const WalletTokenDto = t.Union([
    PrivyWalletTokenDto,
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
