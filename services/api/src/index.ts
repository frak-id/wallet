import { log } from "@api-core";
import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";

const app = new Elysia({
    aot: true,
})
    .use(
        cors({
            methods: ["DELETE", "GET", "POST", "PUT", "PATCH"],
        })
    )
    .get("/health", () => ({
        status: "ok",
        hostname: process.env.HOSTNAME,
        stage: process.env.STAGE,
    }));

log.info(`API V2 running at ${app.server?.hostname}:${app.server?.port}`);

export type App = typeof app;

export default app;
