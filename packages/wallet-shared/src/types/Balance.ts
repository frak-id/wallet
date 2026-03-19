import type { BalanceResponse } from "@frak-labs/backend-elysia/api/schemas";

export type BalanceItem = BalanceResponse["balances"][number];
