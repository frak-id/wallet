import { Elysia } from "elysia";
import { fundingRoutes } from "./routes/funding";
import { oracleRoutes } from "./routes/oracle";

export const business = new Elysia({ prefix: "/business" })
    .use(fundingRoutes)
    .use(oracleRoutes);
