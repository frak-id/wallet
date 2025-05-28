import { Elysia } from "elysia";
import { sendRoutes } from "./send";

export const notificationsRoutes = new Elysia({ prefix: "/notifications" }).use(
    sendRoutes
);
