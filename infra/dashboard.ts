import {
    alchemyApiKey,
    backendUrl,
    indexerUrl,
    isProd,
    mongoBusinessDb,
    nexusRpcSecret,
    sessionEncryptionKy,
    vpc,
    walletUrl,
} from "./config";

const subdomain = isProd ? "business" : "business-dev";

const onRampUrl = new sst.Secret("FUNDING_ON_RAMP_URL");

/**
 * EthCC wallet demo website
 */
export const dashboardWebsite = new sst.aws.Nextjs("Dashboard", {
    path: "packages/dashboard",
    vpc,
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
        FRAK_WALLET_URL: walletUrl,
        BACKEND_URL: backendUrl,
        INDEXER_URL: indexerUrl,
    },
    link: [
        alchemyApiKey,
        nexusRpcSecret,
        sessionEncryptionKy,
        mongoBusinessDb,
        onRampUrl,
    ],
});
