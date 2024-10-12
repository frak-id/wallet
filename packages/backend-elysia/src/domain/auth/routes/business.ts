import { nextSessionContext, sessionContext } from "@backend-common";
import { Elysia } from "elysia";

export const businessAuthRoutes = new Elysia({ prefix: "/business" })
    .use(nextSessionContext)
    .use(sessionContext);
