import { t } from "@backend-utils";
import type { Static } from "elysia";

export const DistributionStatusSchema = t.Union([
    t.Literal("distributing"),
    t.Literal("warning"),
    t.Literal("depleted"),
    t.Literal("paused"),
    t.Literal("not_deployed"),
]);
export type DistributionStatus = Static<typeof DistributionStatusSchema>;

export const BankStatusSchema = t.Object({
    deployed: t.Boolean(),
    bankAddress: t.Union([t.Hex(), t.Null()]),
    ownerHasManagerRole: t.Boolean(),
    // "no_wallet" — walletless owner, role grant deferred to wallet link.
    managerRole: t.Union([
        t.Literal("granted"),
        t.Literal("missing"),
        t.Literal("no_wallet"),
    ]),
});
export type BankStatus = Static<typeof BankStatusSchema>;
