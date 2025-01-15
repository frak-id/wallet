import { Elysia } from "elysia";
import { webhookManagmentRoutes } from "./managment";
import { webhookPushRoutes } from "./push";

export const webhookRoutes = new Elysia({ prefix: "/webhook" })
    .use(webhookPushRoutes)
    .use(webhookManagmentRoutes);
