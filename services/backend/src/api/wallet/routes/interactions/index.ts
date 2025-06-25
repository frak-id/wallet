import { Elysia } from "elysia";
import { purchaseInteractionsRoutes } from "./purchase";
import { pushInteractionsRoutes } from "./push";
import { simulateRoutes } from "./simulate";

export const interactionsRoutes = new Elysia({ prefix: "/interactions" })
    .use(pushInteractionsRoutes)
    .use(simulateRoutes)
    .use(purchaseInteractionsRoutes);
