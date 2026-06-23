import { t } from "@backend-utils";
import type { IdentityType } from "../db/schema";

export const IdentityTypeSchema = t.Union([
    t.Literal("anonymous_fingerprint"),
    t.Literal("wallet"),
    t.Literal("email"),
]);

export type { IdentityType };
