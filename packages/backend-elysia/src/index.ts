import { Elysia } from "elysia";
import { exampleNewsPaper } from "./example/news-paper";

const app = new Elysia()
    .use(exampleNewsPaper)
    .get("/", () => "Hello Elysia")
    .listen(3000);

console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
