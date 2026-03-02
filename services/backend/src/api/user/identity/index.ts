import { Elysia } from "elysia";
import { identityEnsureRoutes } from "./ensure";
import { identityMergeRoutes } from "./merge";

export const identityApi = new Elysia({ prefix: "/identity" })
    .use(identityMergeRoutes)
    .use(identityEnsureRoutes);
