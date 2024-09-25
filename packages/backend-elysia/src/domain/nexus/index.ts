import { Elysia } from "elysia";
import { notificationRoutes } from "./notifications";

export const nexus = new Elysia({ prefix: "/nexus" }).use(notificationRoutes);
