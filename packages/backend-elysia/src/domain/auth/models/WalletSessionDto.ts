import { t } from "@backend-utils";

export const WalletAuthResponseDto = t.Object({
    address: t.Address(),
    authenticatorId: t.String(),
    publicKey: t.Object({
        x: t.Hex(),
        y: t.Hex(),
    }),
    transports: t.Optional(t.Array(t.String())),
    sdkJwt: t.Object({
        token: t.String(),
        expires: t.Number(),
    }),
});
export const WalletTokenDto = t.Object({
    address: t.Address(),
    authenticatorId: t.String(),
    publicKey: t.Object({
        x: t.Hex(),
        y: t.Hex(),
    }),
    transports: t.Optional(t.Array(t.String())),
});
