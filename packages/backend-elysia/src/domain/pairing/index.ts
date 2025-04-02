import { Elysia } from "elysia";
import { managementRoutes } from "./routes/managment";
import { wsRoute } from "./routes/ws";

export const pairing = new Elysia({ prefix: "/pairings" })
    .use(managementRoutes)
    .use(wsRoute);
