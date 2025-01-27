import { t } from "@backend-utils";
import { Elysia } from "elysia";
import { sixDegreesRoutingContext } from "../context";

export const routingRoutes = new Elysia({
    prefix: "/routing",
})
    .use(sixDegreesRoutingContext)
    .get(
        "/",
        async ({ query: { origin }, sixDegreesRouting }) => {
            // If no origin is provided, default to evm
            if (!origin) {
                return "evm";
            }

            // Extract the domain for the URL and check the routing status
            const domain = new URL(origin).hostname;
            const isRouted = await sixDegreesRouting.isRoutedDomain(domain);

            // If it is routed, return sui, otherwise return evm
            return isRouted ? "sui" : "evm";
        },
        {
            query: t.Object({
                origin: t.String(),
            }),
            response: {
                200: t.Union([t.Literal("sui"), t.Literal("evm")]),
            },
        }
    );
