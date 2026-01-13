import { t } from "@backend-utils";

export const BusinessTokenDto = t.Object({
    wallet: t.Address(),
    siwe: t.Optional(
        t.Object({
            message: t.String(),
            signature: t.Hex(),
        })
    ),
});

export const BusinessAuthResponseDto = t.Object({
    token: t.String(),
    wallet: t.Address(),
    expiresAt: t.Number(),
});
