import { Elysia } from "elysia";
import { referralCodeRoutes } from "./code";
import { referralRedemptionRoutes } from "./redemption";
import { referralStatusRoute } from "./status";

export const referralRoutes = new Elysia({ prefix: "/referral" })
    .use(referralCodeRoutes)
    .use(referralRedemptionRoutes)
    .use(referralStatusRoute);
