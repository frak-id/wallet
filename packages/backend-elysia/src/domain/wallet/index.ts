import { Elysia } from "elysia";
import { balanceRoutes } from "./routes/balance";
import { pendingBalanceRoutes } from "./routes/pendingBalance";

export const wallet = new Elysia({ prefix: "/wallet" })
    .use(balanceRoutes)
    .use(pendingBalanceRoutes);
