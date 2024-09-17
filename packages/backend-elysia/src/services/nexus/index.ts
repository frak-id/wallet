import { Elysia } from "elysia";
import { notificationRoutes } from "./routes/notification";
import { pushTokenRoutes } from "./routes/pushToken";

export const nexus = new Elysia({ prefix: "/nexus" })
    .use(pushTokenRoutes)
    .use(notificationRoutes);
