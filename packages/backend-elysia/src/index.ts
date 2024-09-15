import { Elysia } from "elysia";
import { exampleNewsPaper } from "./modules";

const app = new Elysia()
    .get("/", () => {
        return { status: "ok" };
    })
    .use(exampleNewsPaper)
    .listen(3000);

console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);

export type App = typeof app;
