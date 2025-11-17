import { Elysia, t } from "elysia";

export const routingRoutes = new Elysia().get(
    "/routing",
    () => "evm" as const,
    {
        query: t.Object({
            origin: t.String(),
        }),
        response: {
            200: t.Union([t.Literal("sui"), t.Literal("evm")]),
        },
    }
);
