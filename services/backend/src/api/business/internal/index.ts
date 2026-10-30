import { Elysia } from "elysia";
import { internalBankRoutes } from "./bank";
import { internalGameRoutes } from "./game";
import { internalReferralCodeRoutes } from "./referralCodes";
import { internalToolRoutes } from "./tools";

/** Frak's internal tools: every route is platform-admin only, guarded in each group. */
export const internalRoutes = new Elysia({ prefix: "/internal" })
    .use(internalReferralCodeRoutes)
    .use(internalGameRoutes)
    .use(internalBankRoutes)
    .use(internalToolRoutes);
