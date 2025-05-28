import { Elysia } from "elysia";
import { authRoutes } from "./routes/auth";
import { balanceRoutes } from "./routes/balance";
import { interactionsRoutes } from "./routes/interactions";
import { notificationRoutes } from "./routes/notifications";
import { pairingRoutes } from "./routes/pairing";

export const walletApi = new Elysia({ prefix: "/wallet" })
    // Routes
    .use(authRoutes)
    .use(pairingRoutes)
    .use(notificationRoutes)
    .use(balanceRoutes)
    .use(interactionsRoutes);
