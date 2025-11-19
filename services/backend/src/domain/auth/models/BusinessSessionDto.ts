import { t } from "@backend-utils";
import type { Static } from "elysia";

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

export type StaticBusinessTokenDto = Static<typeof BusinessTokenDto>;
export type StaticBusinessAuthResponseDto = Static<
    typeof BusinessAuthResponseDto
>;
