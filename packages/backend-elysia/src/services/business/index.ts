import { Elysia } from "elysia";
import { fundingRoutes } from "./routes/funding";

export const business = new Elysia({ prefix: "/business" }).use(fundingRoutes);
