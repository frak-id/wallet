import { t } from "@backend-utils";
import type { Static } from "elysia";

export const IdentityTypeSchema = t.Union([
    t.Literal("anonymous_fingerprint"),
    t.Literal("wallet"),
]);

export type IdentityType = Static<typeof IdentityTypeSchema>;
