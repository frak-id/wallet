import { Elysia } from "elysia";

export const mintRoutes = new Elysia({ prefix: "/mint" }).post(
    "/verify",
    async () => {
        return "ok";
    }
);
