import { Elysia } from "elysia";
import { pushInteractionsRoutes } from "./push";
import { simulateRoutes } from "./simulate";

export const interactionsRoutes = new Elysia({ prefix: "/interactions" })
    .use(pushInteractionsRoutes)
    .use(simulateRoutes);
