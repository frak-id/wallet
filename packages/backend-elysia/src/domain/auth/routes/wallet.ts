import { nextSessionContext, sessionContext } from "@backend-common";
import { Elysia } from "elysia";

export const walletAuthRoutes = new Elysia({ prefix: "/wallet" })
    .use(nextSessionContext)
    .use(sessionContext);
