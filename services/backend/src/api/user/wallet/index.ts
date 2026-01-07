import { Elysia } from "elysia";
import { authRoutes } from "./routes/auth";
import { balanceRoutes } from "./routes/balance";
import { notificationRoutes } from "./routes/notifications";
import { pairingRoutes } from "./routes/pairing";

export const walletApi = new Elysia({ prefix: "/wallet" })
    .use(authRoutes)
    .use(pairingRoutes)
    .use(notificationRoutes)
    .use(balanceRoutes);
