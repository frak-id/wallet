import { Elysia } from "elysia";
import { authRoutes } from "./auth";
import { fundingRoutes } from "./funding";
import { merchantRoutes } from "./merchant";
import { businessSessionContext } from "./middleware/session";
import { notificationsRoutes } from "./notifications";

export const businessApi = new Elysia({ prefix: "/business" })
    .use(authRoutes)
    .use(businessSessionContext)
    .use(fundingRoutes)
    .use(notificationsRoutes)
    .use(merchantRoutes);
