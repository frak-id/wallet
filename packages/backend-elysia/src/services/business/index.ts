import { Elysia } from "elysia";
import { blockchainContext } from "../../common/context";
import { fundingRoutes } from "./routes/funding";

export const business = new Elysia({ prefix: "/business" })
    .use(blockchainContext)
    .use(fundingRoutes)
    .get("/status", () => ({
        ok: true,
    }));
