import { Elysia } from "elysia";
import { pushTokensRoutes } from "./routes/pushTokens";
import { sendRoutes } from "./routes/send";

export const notifications = new Elysia({
    prefix: "/notifications",
})
    .use(pushTokensRoutes)
    .use(sendRoutes);
