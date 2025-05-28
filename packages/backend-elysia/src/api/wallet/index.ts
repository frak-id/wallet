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

// todo: jobs to migrate -> every crons
// todo: external to migrate -> webhook
// todo: route mapper -> webhook + purchase tracker
//  - interactions/listenForPurchase -> wallet/interactions/listenForPurchase
//  - /oracle/:type/:productId/hook -> external/wh/oracle/:type/:productId
//  - /interactions/webhook/:productId/pushRaw -> external/wh/interactions/webhook/:productId/pushRaw




