import { Elysia } from "elysia";

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)}MB`;

export const debugRoutes = new Elysia({ prefix: "/debug" })
    .get("/memory", async () => {
        const { heapStats } = await import("bun:jsc");
        const mem = process.memoryUsage();
        const jsc = heapStats();

        return {
            rss: mb(mem.rss),
            heapUsed: mb(mem.heapUsed),
            heapTotal: mb(mem.heapTotal),
            external: mb(mem.external),
            jsc,
        };
    })
    .get("/memory/gc", async () => {
        const { heapStats } = await import("bun:jsc");

        const before = heapStats();
        const memBefore = process.memoryUsage();

        Bun.gc(true);

        const after = heapStats();
        const memAfter = process.memoryUsage();

        return {
            before: {
                rss: mb(memBefore.rss),
                heapUsed: mb(memBefore.heapUsed),
                jsc: before,
            },
            after: {
                rss: mb(memAfter.rss),
                heapUsed: mb(memAfter.heapUsed),
                jsc: after,
            },
            pinned: after.protectedObjectTypeCounts,
        };
    });
