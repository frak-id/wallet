import { Elysia } from "elysia";
import { balanceRoutes } from "./routes/balance";

export const wallet = new Elysia({ prefix: "/wallet" }).use(balanceRoutes);
