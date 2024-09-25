import { Elysia } from "elysia";
import { pushInteractionsRoutes } from "./routes/push";

export const interactionRoutes = new Elysia({
    prefix: "/interactions",
}).use(pushInteractionsRoutes);
