import {
    backendUrl,
    drpcApiKey,
    erpcUrl,
    indexerUrl,
    mongoBusinessDb,
    nexusRpcSecret,
    openPanelApiUrl,
    openPanelBusinessClientId,
    sessionEncryptionKy,
    umamiBusinessWebsiteId,
    walletUrl,
} from "./config";
import { isProd } from "./utils";

const subdomain = isProd ? "business" : "business-dev";

const onRampUrl = new sst.Secret("FUNDING_ON_RAMP_URL");

/**
 * Business dashboard
 */
export const dashboardWebsite = new sst.aws.Nextjs("Dashboard", {
    path: "apps/dashboard",
    // Set the custom domain
    domain: {
        name: `${subdomain}.frak.id`,
    },
    // Enable image optimization
    imageOptimization: {
        memory: "512 MB",
        staticEtag: true,
    },
    // Environment variables
    environment: {
        STAGE: $app.stage,
        FRAK_WALLET_URL: walletUrl,
        BACKEND_URL: backendUrl,
        INDEXER_URL: indexerUrl,
        ERPC_URL: erpcUrl,
        UMAMI_BUSINESS_WEBSITE_ID: umamiBusinessWebsiteId.value,
        OPEN_PANEL_API_URL: openPanelApiUrl,
        OPEN_PANEL_BUSINESS_CLIENT_ID: openPanelBusinessClientId.value,
    },
    link: [
        drpcApiKey,
        nexusRpcSecret,
        sessionEncryptionKy,
        mongoBusinessDb,
        onRampUrl,
    ],
});

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
        output: "build/client",
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
