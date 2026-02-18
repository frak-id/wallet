import { t } from "@backend-utils";
import type { Static } from "elysia";

export const BankStatusSchema = t.Object({
    deployed: t.Boolean(),
    bankAddress: t.Union([t.Hex(), t.Null()]),
    ownerHasManagerRole: t.Boolean(),
});
export type BankStatus = Static<typeof BankStatusSchema>;
