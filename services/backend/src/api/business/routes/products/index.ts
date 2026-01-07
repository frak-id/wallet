import { Elysia } from "elysia";
import { mintRoutes } from "./mint";
import { oracleWhRoutes } from "./oracleWh";

export const productRoutes = new Elysia({ prefix: "/product" })
    .use(mintRoutes)
    .group("/:productId", (app) => app.use(oracleWhRoutes));
