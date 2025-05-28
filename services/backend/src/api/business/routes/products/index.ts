import { Elysia } from "elysia";
import { interactionsWhRoutes } from "./interactionWh";
import { mintRoutes } from "./mint";
import { oracleWhRoutes } from "./oracleWh";

export const productRoutes = new Elysia({ prefix: "/product" })
    // Product wide
    .use(mintRoutes)
    // Product specific
    .group("/:productId", (app) =>
        app.use(interactionsWhRoutes).use(oracleWhRoutes)
    );
