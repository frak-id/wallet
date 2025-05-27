import { Elysia } from "elysia";
import { webhookPushRoutes } from "./push";

export const webhookRoutes = new Elysia({ prefix: "/webhook" }).use(
    webhookPushRoutes
);
