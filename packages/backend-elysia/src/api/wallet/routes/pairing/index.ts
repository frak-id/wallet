import { Elysia } from "elysia";
import { pairingContext } from "../../../../domain/pairing";
import { cleanupCron } from "./cleanup";
import { managementRoutes } from "./managment";
import { wsRoute } from "./ws";

export const pairingRoutes = new Elysia({ prefix: "/pairings" })
    .use(pairingContext)
    .use(managementRoutes)
    .use(wsRoute)
    .use(cleanupCron);
