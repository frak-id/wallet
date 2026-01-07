import { Elysia } from "elysia";
import { tokensRoutes } from "./tokens";

export const notificationRoutes = new Elysia({ prefix: "/notifications" }).use(
    tokensRoutes
);
