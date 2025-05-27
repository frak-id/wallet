import { Elysia } from "elysia";
import { walletAuthRoutes } from "./routes/wallet";

export const auth = new Elysia({ prefix: "/auth" }).use(walletAuthRoutes);
