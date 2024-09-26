import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { commonRoutes } from "./common/routes";
import { business, exampleNewsPaper, nexus } from "./domain";

const app = new Elysia()
    .use(cors())
    .get("/", () => ({ status: "ok" }))
    .use(commonRoutes)
    // Example news paper logics
    .use(exampleNewsPaper)
    // Business logics
    .use(business)
    .use(nexus)
    .listen(Number.parseInt(process.env.PORT ?? "3030"));

console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);

export type App = typeof app;
