import Elysia from "elysia";
import { nexusContext } from "../context";

export const notificationRoutes = new Elysia({ prefix: "notification" }).use(
    nexusContext
);
