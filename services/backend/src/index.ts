import { log } from "@backend-infrastructure";
import { cors } from "@elysiajs/cors";
import { isRunningInProd, isRunningLocally } from "@frak-labs/app-essentials";
import { Elysia } from "elysia";
import { businessApi } from "./api/business";
import { commonApi } from "./api/common";
import { wellKnownRoutes } from "./api/common/wellKnown";
import { externalApi } from "./api/external";
import { userApi } from "./api/user";
import { jobs } from "./jobs";
import { legacyRouteMapper } from "./legacyRoutes";
import { OrchestrationContext } from "./orchestration";

// Full on service app
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
    .use(wellKnownRoutes)
    .use(commonApi)
    .use(businessApi)
    .use(userApi)
    .use(externalApi)
    // All the jobs
    .use(jobs)
    // Finally, the legacy route mapper routes
    .use(legacyRouteMapper);

if (!isRunningInProd) {
    app.get("/debug/memory", async () => {
        const { heapStats } = await import("bun:jsc");
        const mem = process.memoryUsage();
        const jsc = heapStats();

        return {
            rss: `${(mem.rss / 1024 / 1024).toFixed(1)}MB`,
            heapUsed: `${(mem.heapUsed / 1024 / 1024).toFixed(1)}MB`,
            heapTotal: `${(mem.heapTotal / 1024 / 1024).toFixed(1)}MB`,
            external: `${(mem.external / 1024 / 1024).toFixed(1)}MB`,
            jsc,
        };
    });

    app.get("/debug/memory/gc", async () => {
        const { heapStats } = await import("bun:jsc");

        const before = heapStats();
        const memBefore = process.memoryUsage();

        Bun.gc(true);

        const after = heapStats();
        const memAfter = process.memoryUsage();

        return {
            before: {
                rss: `${(memBefore.rss / 1024 / 1024).toFixed(1)}MB`,
                heapUsed: `${(memBefore.heapUsed / 1024 / 1024).toFixed(1)}MB`,
                jsc: before,
            },
            after: {
                rss: `${(memAfter.rss / 1024 / 1024).toFixed(1)}MB`,
                heapUsed: `${(memAfter.heapUsed / 1024 / 1024).toFixed(1)}MB`,
                jsc: after,
            },
            pinned: after.protectedObjectTypeCounts,
        };
    });

    app.get("/debug/memory/snapshot", async () => {
        Bun.gc(true);

        const snapshot = (Bun as any).generateHeapSnapshot();
        const filename = `/tmp/heap-${Date.now()}.heapsnapshot`;
        await Bun.write(filename, JSON.stringify(snapshot));

        return {
            path: filename,
            hint: `kubectl cp <namespace>/<pod>:${filename} ./heap.heapsnapshot`,
        };
    });
}

app.listen({
    port: Number.parseInt(process.env.PORT ?? "3030", 10),
});

log.info(`Running at ${app.server?.hostname}:${app.server?.port}`);

export type App = typeof app;

export type BusinessApp = typeof businessApi;
export type UserApp = typeof userApi;
export type CommonApp = typeof commonApi;
