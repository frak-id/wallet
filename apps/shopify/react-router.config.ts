import type { Config } from "@react-router/dev/config";

export default {
    future: {
        // All v8 future flags adopted on RR7 so the eventual v8 bump is near-noop.
        // v8_trailingSlashAwareDataRequests + v8_passThroughRequests graduate to
        // default (and are removed) in v8 — see Part B4 of the migration plan.
        v8_viteEnvironmentApi: true,
        v8_trailingSlashAwareDataRequests: true,
        v8_splitRouteModules: true,
        v8_middleware: true,
        v8_passThroughRequests: true,
    },
    // APP_URL is the dev tunnel, set only by `shopify app dev`.
    allowedActionOrigins: [
        "*.frak.id",
        ...(process.env.APP_URL ? [new URL(process.env.APP_URL).host] : []),
    ],
} satisfies Config;
