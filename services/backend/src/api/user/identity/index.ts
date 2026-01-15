import { Elysia } from "elysia";
import { identityMergeRoutes } from "./merge";

export const identityApi = new Elysia({ prefix: "/identity" }).use(
    identityMergeRoutes
);
