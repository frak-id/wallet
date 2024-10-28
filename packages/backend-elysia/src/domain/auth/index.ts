import { Elysia } from "elysia";
import { businessAuthRoutes } from "./routes/business";
import { walletAuthRoutes } from "./routes/wallet";

export const auth = new Elysia({ prefix: "/auth" })
    .use(walletAuthRoutes)
    .use(businessAuthRoutes);
