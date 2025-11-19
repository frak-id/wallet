import { Elysia } from "elysia";
import { businessSessionContext } from "./middleware/session";
import { authRoutes } from "./routes/auth";
import { fundingRoutes } from "./routes/funding";
import { notificationsRoutes } from "./routes/notifications";
import { productRoutes } from "./routes/products";
import { rolesRoutes } from "./routes/roles";

export const businessApi = new Elysia({ prefix: "/business" })
    // Auth routes (no session middleware needed for login)
    .use(authRoutes)
    // Middleware for authenticated routes
    .use(businessSessionContext)
    // Routes
    .use(fundingRoutes)
    .use(productRoutes)
    .use(rolesRoutes)
    .use(notificationsRoutes);
