import { Elysia } from "elysia";
import { mergePreviewRoutes } from "./preview";
import { mergeSettleRoutes } from "./settle";

export const mergeRoutes = new Elysia({ prefix: "/merge" })
    .use(mergePreviewRoutes)
    .use(mergeSettleRoutes);
