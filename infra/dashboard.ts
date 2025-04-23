import {
    backendUrl,
    drpcApiKey,
    erpcUrl,
    indexerUrl,
    mongoBusinessDb,
    nexusRpcSecret,
    sessionEncryptionKy,
    walletUrl,
} from "./config";
import { isProd } from "./utils";

const subdomain = isProd ? "business" : "business-dev";

const onRampUrl = new sst.Secret("FUNDING_ON_RAMP_URL");

/**
 * Business dashboard
 */
export const dashboardWebsite = new sst.aws.Nextjs("Dashboard", {
    path: "packages/dashboard",
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
    path: "packages/dashboard-admin",
    // Set the custom domain
    domain: {
        name: `${isProd ? "admin" : "admin-dev"}.frak.id`,
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
});
