import { t } from "@backend-utils";
import type { Static } from "elysia";

export const DistributionStatusSchema = t.Union([
    t.Literal("distributing"),
    t.Literal("low_funds"),
    t.Literal("depleted"),
    t.Literal("paused"),
    t.Literal("not_deployed"),
]);
export type DistributionStatus = Static<typeof DistributionStatusSchema>;

export const BankStatusSchema = t.Object({
    deployed: t.Boolean(),
    bankAddress: t.Union([t.Hex(), t.Null()]),
    ownerHasManagerRole: t.Boolean(),
    distributionStatus: DistributionStatusSchema,
});
export type BankStatus = Static<typeof BankStatusSchema>;
