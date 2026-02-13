import { Elysia } from "elysia";
import { businessSessionContext } from "./middleware/session";
import { authRoutes } from "./routes/auth";
import { fundingRoutes } from "./routes/funding";
import { merchantRoutes } from "./routes/merchant";
import { notificationsRoutes } from "./routes/notifications";
import { shopifyRoutes } from "./routes/shopify";

export const businessApi = new Elysia({ prefix: "/business" })
    .use(authRoutes)
    .use(shopifyRoutes)
    .use(businessSessionContext)
    .use(fundingRoutes)
    .use(notificationsRoutes)
    .use(merchantRoutes);
