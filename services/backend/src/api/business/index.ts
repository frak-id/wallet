import { Elysia } from "elysia";
import { businessSessionContext } from "./middleware/session";
import { authRoutes } from "./routes/auth";
import { fundingRoutes } from "./routes/funding";
import { merchantRoutes } from "./routes/merchant";
import { notificationsRoutes } from "./routes/notifications";
import { rolesRoutes } from "./routes/roles";

export const businessApi = new Elysia({ prefix: "/business" })
    .use(authRoutes)
    .use(businessSessionContext)
    .use(fundingRoutes)
    .use(rolesRoutes)
    .use(notificationsRoutes)
    .use(merchantRoutes);
