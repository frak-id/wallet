import { Elysia } from "elysia";
import { managementRoutes } from "./management";
import { wsRoute } from "./ws";

export const pairingRoutes = new Elysia({ prefix: "/pairings" })
    .use(managementRoutes)
    .use(wsRoute);
