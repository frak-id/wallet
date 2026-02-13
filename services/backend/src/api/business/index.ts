import { Elysia } from "elysia";
import { businessSessionContext } from "./middleware/session";
import { authRoutes } from "./routes/auth";
import { fundingRoutes } from "./routes/funding";
import { merchantRoutes } from "./routes/merchant";
import { notificationsRoutes } from "./routes/notifications";

export const businessApi = new Elysia({ prefix: "/business" })
    .use(authRoutes)
    .use(businessSessionContext)
    .use(fundingRoutes)
    .use(notificationsRoutes)
    .use(merchantRoutes);
