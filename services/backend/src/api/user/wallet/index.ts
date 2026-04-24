import { Elysia } from "elysia";
import { authRoutes } from "./auth";
import { balanceRoutes } from "./balance";
import { notificationRoutes } from "./notifications";
import { pairingRoutes } from "./pairing";
import { referralCodeRoutes } from "./referral-code";
import { rewardsRoutes } from "./rewards";

export const walletApi = new Elysia({ prefix: "/wallet" })
    .use(authRoutes)
    .use(pairingRoutes)
    .use(notificationRoutes)
    .use(balanceRoutes)
    .use(rewardsRoutes)
    .use(referralCodeRoutes);
