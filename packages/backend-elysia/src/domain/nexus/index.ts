import { Elysia } from "elysia";
import { interactionRoutes } from "./interactions";
import { notificationRoutes } from "./notifications";

export const nexus = new Elysia({ prefix: "/nexus" })
    .use(notificationRoutes)
    .use(interactionRoutes);
