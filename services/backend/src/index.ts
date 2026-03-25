import { log } from "@backend-infrastructure";
import { cors } from "@elysiajs/cors";
import { isRunningInProd, isRunningLocally } from "@frak-labs/app-essentials";
import { Elysia } from "elysia";
import { businessApi } from "./api/business";
import { commonApi } from "./api/common";
import { wellKnownRoutes } from "./api/common/wellKnown";
import { externalApi } from "./api/external";
import { userApi } from "./api/user";
import { debugRoutes } from "./debug";
import { CronRegistry } from "./jobs";
import { legacyRouteMapper } from "./legacyRoutes";
import { OrchestrationContext } from "./orchestration";

// Mitigate Bun RSS memory growth (oven-sh/bun#21560) — liveness probe triggers restart after 24h
const bootTime = Date.now();
const ONE_DAY_MS = 24 * 60 * 60_000;
const GRACE_PERIOD_MS = 10 * 60_000;

const app = new Elysia({
    aot: true,
    // Websocket specific config
    websocket: {
        // Idle timeout of 5min in seconds, could take a long time for a pairing to be resolved
        idleTimeout: 300,
    },
})
    .onStart(async () => {
        OrchestrationContext.orchestrators.notification.registerListeners();
        CronRegistry.start();
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
    .get("/health", ({ set }) => {
        if (bootTime > Date.now() - GRACE_PERIOD_MS) {
            return { status: "ok", uptime: "fresh" };
        }
        if (bootTime < Date.now() - ONE_DAY_MS) {
            set.status = 500;
            return "Service too old, requesting restart";
        }
        return {
            status: "ok",
            hostname: process.env.HOSTNAME,
            stage: process.env.STAGE,
        };
    })
    .use(wellKnownRoutes)
    .use(commonApi)
    .use(businessApi)
    .use(userApi)
    .use(externalApi)
    // Finally, the legacy route mapper routes
    .use(legacyRouteMapper);

if (!isRunningInProd) {
    app.use(debugRoutes);
}

app.listen({
    port: Number.parseInt(process.env.PORT ?? "3030", 10),
});

log.info(`Running at ${app.server?.hostname}:${app.server?.port}`);

/**
 * Global graceful shutdown — stops accepting connections and drains in-flight requests.
 * PairingRepository's own SIGTERM handler flushes pending DB writes independently.
 */
function handleShutdown(signal: string) {
    log.info(`${signal} received, starting graceful shutdown`);
    CronRegistry.stop();
    app.server?.stop(false);
    setTimeout(() => {
        log.warn("Shutdown timeout exceeded, forcing exit");
        process.exit(1);
    }, 15_000).unref();
}

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));

export type App = typeof app;

export type BusinessApp = typeof businessApi;
export type UserApp = typeof userApi;
export type CommonApp = typeof commonApi;
