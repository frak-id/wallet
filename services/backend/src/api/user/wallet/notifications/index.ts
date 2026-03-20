import { Elysia } from "elysia";
import { historyRoutes } from "./history";
import { tokensRoutes } from "./tokens";

export const notificationRoutes = new Elysia({ prefix: "/notifications" })
    .use(tokensRoutes)
    .use(historyRoutes);
