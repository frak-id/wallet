import { Elysia, t } from "elysia";
import { sixDegreesContext } from "../../../../domain/6degrees/context";

export const routingRoutes = new Elysia().use(sixDegreesContext).get(
    "/routing",
    async ({ query: { origin }, sixDegrees: { routingService } }) => {
        // If no origin is provided, default to evm
        if (!origin) {
            return "evm";
        }

        // Extract the domain for the URL and check the routing status
        const domain = new URL(origin).hostname;
        const isRouted = await routingService.isRoutedDomain(domain);

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
