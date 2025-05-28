import { Elysia } from "elysia";
import { pairingContext } from "../../../../domain/pairing";
import { managementRoutes } from "./management";
import { wsRoute } from "./ws";

export const pairingRoutes = new Elysia({ prefix: "/pairings" })
    .use(pairingContext)
    .use(managementRoutes)
    .use(wsRoute);
