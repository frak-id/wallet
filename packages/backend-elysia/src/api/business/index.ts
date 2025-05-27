import { Elysia } from "elysia";
import { businessSessionContext } from "./middleware/session";
import { fundingRoutes } from "./routes/funding";
import { notificationsRoutes } from "./routes/notifications";
import { productRoutes } from "./routes/products";
import { rolesRoutes } from "./routes/roles";

export const businessApi = new Elysia({ prefix: "/business" })
    // Middleware for every routes
    .use(businessSessionContext)
    // Routes
    .use(fundingRoutes)
    .use(productRoutes)
    .use(rolesRoutes)
    .use(notificationsRoutes);
