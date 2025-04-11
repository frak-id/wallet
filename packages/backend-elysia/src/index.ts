import { log } from "@backend-common";
import { cors } from "@elysiajs/cors";
import { isRunningLocally } from "@frak-labs/app-essentials";
import { Elysia } from "elysia";
import { commonRoutes } from "./common/routes";
import {
    auth,
    business,
    exampleNewsPaper,
    interactions,
    notifications,
    oracle,
    pairing,
    sixDegrees,
    wallet,
} from "./domain";

// Full on service app
const app = new Elysia({
    aot: true,
    precompile: true,
    // Websocket specific config
    websocket: {
        // Idle timeout of 5min in seconds, could take a long time for a pairing to be resolved
        idleTimeout: 300,
    },
})
    .use(
        log.into({
            autoLogging: isRunningLocally,
        })
    )
    .use(
        cors({
            origin: "*",
            methods: ["DELETE", "GET", "POST", "PUT", "PATCH"],
        })
    )
    .get("/health", () => ({
        status: "ok",
        hostname: process.env.HOSTNAME,
        stage: process.env.STAGE,
    }))
    .use(commonRoutes)
    // Business logics
    .use(auth)
    .use(oracle)
    .use(interactions)
    .use(notifications)
    .use(wallet)
    .use(business)
    .use(pairing)
    // 6 degrees related logics
    .use(sixDegrees)
    // Example news paper logics (lazy loaded)
    .use(exampleNewsPaper)
    // Setup bun serve options
    .listen({
        port: Number.parseInt(process.env.PORT ?? "3030"),
    });

log.info(`Running at ${app.server?.hostname}:${app.server?.port}`);

export type App = typeof app;
