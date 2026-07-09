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
    allowedActionOrigins: ["*.frak.id"],
} satisfies Config;
