import { t } from "@backend-utils";
import type { Static } from "elysia";

export const EmailStatusResponseSchema = t.Union([
    t.Object({ used: t.Literal(false) }),
    t.Object({
        used: t.Literal(true),
        authenticatorId: t.String(),
        wallet: t.Optional(t.Address()),
    }),
]);
export type EmailStatusResponse = Static<typeof EmailStatusResponseSchema>;
