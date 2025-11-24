import { indexerUrl } from "./config";
import { isProd } from "./utils";

/**
 * Admin business website
 */
new sst.aws.StaticSite("Admin", {
    path: "apps/dashboard-admin",
    // Set the custom domain
    domain: {
        name: `${isProd ? "admin-stats" : "admin-stats-dev"}.frak.id`,
    },
    build: {
        command: "bun run build",
        output: "dist",
    },
    vite: {
        types: "./sst-env.d.ts",
    },
    // Environment variables
    environment: {
        STAGE: $app.stage,
        INDEXER_URL: indexerUrl,
    },
    dev: { autostart: false },
});
