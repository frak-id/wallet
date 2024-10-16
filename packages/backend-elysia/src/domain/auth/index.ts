import { Elysia } from "elysia";
import { businessAuthRoutes } from "./routes/business";
import { walletAuthRoutes } from "./routes/wallet";
import { walletSdkAuthRoutes } from "./routes/walletSdk";

export const auth = new Elysia({ prefix: "/auth" })
    .use(walletAuthRoutes)
    .use(walletSdkAuthRoutes)
    .use(businessAuthRoutes);
