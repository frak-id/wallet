import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { business, exampleNewsPaper, interactions } from "./services";

const app = new Elysia()
    .use(cors())
    .get("/", () => ({ status: "ok" }))
    // Example news paper logics
    .use(exampleNewsPaper)
    // Business logics
    .use(business)
    .use(interactions)
    .listen(Number.parseInt(process.env.PORT ?? "3030"));

console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);

export type App = typeof app;
