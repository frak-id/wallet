import { t } from "@backend-utils";

export const WalletSessionResponseDto = t.Object({
    address: t.Address(),
    authenticatorId: t.String(),
    publicKey: t.Object({
        x: t.Hex(),
        y: t.Hex(),
    }),
    sdkJwt: t.Object({
        token: t.String(),
        expires: t.Number(),
    }),
});
