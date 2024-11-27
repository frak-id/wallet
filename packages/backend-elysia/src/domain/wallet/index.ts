import { Elysia } from "elysia";
import { balanceRoutes } from "./routes/balance";
import { rewardsRoutes } from "./routes/rewards";

export const wallet = new Elysia({ prefix: "/wallet" })
    .use(balanceRoutes)
    .use(rewardsRoutes);
