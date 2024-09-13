import { Elysia } from "elysia";

export const exampleNewsPaper = new Elysia({
    prefix: "/example/news-paper",
}).get("/", () => "Hello News Paper");
