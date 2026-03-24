import { t } from "@backend-utils";
import type { Static } from "elysia";

export const BalanceResponseSchema = t.Object({
    total: t.TokenAmount,
    balances: t.Array(
        t.Composite([
            t.TokenAmount,
            t.Object({
                token: t.Address(),
                name: t.String(),
                symbol: t.String(),
                decimals: t.Number(),
                rawBalance: t.Hex(),
            }),
        ])
    ),
});
export type BalanceResponse = Static<typeof BalanceResponseSchema>;
