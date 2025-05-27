import { Elysia } from "elysia";
import { businessSessionContext } from "./middleware/session";
import { fundingRoutes } from "./routes/funding";
import { interactionsManagementRoutes } from "./routes/interactions/management";
import { mintRoutes } from "./routes/mint";
import { oracleManagementRoutes } from "./routes/oracle/management";
import { rolesRoutes } from "./routes/roles";

export const businessApi = new Elysia({ prefix: "/business" })
    // Middleware for every routes
    .use(businessSessionContext)
    // Routes
    .use(fundingRoutes)
    .use(mintRoutes)
    .use(rolesRoutes)
    .use(oracleManagementRoutes)
    .use(interactionsManagementRoutes);
