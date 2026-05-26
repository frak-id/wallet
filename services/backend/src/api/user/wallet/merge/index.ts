import { rateLimitMiddleware } from "@backend-infrastructure";
import { Elysia } from "elysia";
import { mergePreviewRoutes } from "./preview";
import { mergeSettleRoutes } from "./settle";

export const mergeRoutes = new Elysia({ prefix: "/merge" })
    .use(rateLimitMiddleware({ windowMs: 60_000, maxRequests: 5 }))
    .use(mergePreviewRoutes)
    .use(mergeSettleRoutes);
