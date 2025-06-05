import { log } from "@backend-common";
import { cors } from "@elysiajs/cors";
import { isRunningLocally } from "@frak-labs/app-essentials";
import { Elysia } from "elysia";
import { businessApi } from "./api/business";
import { commonApi } from "./api/common";
import { externalApi } from "./api/external";
import { walletApi } from "./api/wallet";
import { jobs } from "./jobs";
import { legacyRouteMapper } from "./legacyRoutes";

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
            methods: ["DELETE", "GET", "POST", "PUT", "PATCH"],
        })
    )
    .get("/health", () => ({
        status: "ok",
        hostname: process.env.HOSTNAME,
        stage: process.env.STAGE,
    }))
    .use(commonApi)
    .use(businessApi)
    .use(walletApi)
    .use(externalApi)
    // All the jobs
    .use(jobs)
    // Finally, the legacy route mapper routes
    .use(legacyRouteMapper)
    // Setup bun serve options
    .listen({
        port: Number.parseInt(process.env.PORT ?? "3030"),
    });

log.info(`Running at ${app.server?.hostname}:${app.server?.port}`);

export type App = typeof app;

export type BusinessApp = typeof businessApi;
export type WalletApp = typeof walletApi;
export type CommonApp = typeof commonApi;
