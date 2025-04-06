import { Elysia } from "elysia";
import { pairingContext } from "./context";
import { cleanupCron } from "./routes/cleanup";
import { managementRoutes } from "./routes/managment";
import { wsRoute } from "./routes/ws";

export const pairing = new Elysia({ prefix: "/pairings" })
    .use(pairingContext)
    .use(managementRoutes)
    .use(wsRoute)
    .use(cleanupCron);
