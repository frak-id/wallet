import { Elysia } from "elysia";
import { interactionsContext } from "../context";

export const pushInteractionsRoutes = new Elysia()
    .use(interactionsContext)
    .post("/push", () => "ok");
