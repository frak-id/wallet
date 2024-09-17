import { Elysia } from "elysia";
import { pushTokenRoutes } from "./routes/pushToken";

export const nexus = new Elysia({ prefix: "/nexus" }).use(pushTokenRoutes);
