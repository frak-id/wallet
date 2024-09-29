import { log } from "@backend-common";
import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { commonRoutes } from "./common/routes";
import {
    business,
    exampleNewsPaper,
    interactions,
    notifications,
    oracle,
} from "./domain";

const app = new Elysia()
    .use(cors())
    .use(log.into({ autoLogging: false }))
    .get("/", () => ({ status: "ok" }))
    .use(commonRoutes)
    // Example news paper logics
    .use(exampleNewsPaper)
    // Business logics
    .use(oracle)
    .use(interactions)
    .use(notifications)
    .use(business)
    .listen(Number.parseInt(process.env.PORT ?? "3030"));

log.info(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);

export type App = typeof app;
