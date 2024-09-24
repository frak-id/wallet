import { Elysia } from "elysia";
import { oracleRoutes } from "./oracle";
import { fundingRoutes } from "./routes/funding";

export const business = new Elysia({ prefix: "/business" })
    .use(fundingRoutes)
    .use(oracleRoutes);
