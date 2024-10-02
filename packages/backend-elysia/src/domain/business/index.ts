import { Elysia } from "elysia";
import { fundingRoutes } from "./routes/funding";
import { mintRoutes } from "./routes/mint";

export const business = new Elysia({ prefix: "/business" })
    .use(fundingRoutes)
    .use(mintRoutes);
