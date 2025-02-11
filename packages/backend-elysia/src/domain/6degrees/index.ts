import { Elysia } from "elysia";
import { routingRoutes } from "./routes/routing";

export const sixDegrees = new Elysia({
    prefix: "/sixDegrees",
}).use(routingRoutes);
