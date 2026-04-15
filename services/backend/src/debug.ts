import { Elysia } from "elysia";

export const debugRoutes = new Elysia({ prefix: "/debug" })
    .get("/memory", async () => {
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
