import { isProd } from "./utils";

// Get some info about the deployment env
const isLocal = $dev ?? false;

/**
 * Get a static variable depending on the stack
 * @param string
 * @param string
 * @param local
 */
export function getStaticVariable({
    prod,
    dev,
    local,
}: {
    prod: string;
    dev: string;
    local?: string;
}) {
    if (isProd) {
        return prod;
    }
    if (isLocal) {
        return local ?? dev;
    }
    return dev;
}

// Some simple config depending on the stack
export const indexerUrl = isProd
    ? "https://ponder.gcp.frak.id"
    : "https://ponder.gcp-dev.frak.id";
export const erpcUrl = isProd
    ? "https://erpc.gcp.frak.id/nexus-rpc/evm/"
    : "https://erpc.gcp-dev.frak.id/nexus-rpc/evm/";
export const backendUrl = getStaticVariable({
    prod: "https://backend.frak.id",
    dev: "https://backend.gcp-dev.frak.id",
    local: "http://localhost:3030",
});
export const walletUrl = getStaticVariable({
    prod: "https://wallet.frak.id",
    dev: "https://wallet-dev.frak.id",
    local: "https://localhost:3000",
});
export const businessUrl = getStaticVariable({
    prod: "https://business.frak.id",
    dev: "https://business-dev.frak.id",
    local: "https://localhost:3001",
});
export const openPanelApiUrl = "https://op-api.gcp.frak.id";

// Some secrets
export const drpcApiKey = new sst.Secret("DRPC_API_KEY");
export const pimlicoApiKey = new sst.Secret("PIMLICO_API_KEY");
export const nexusRpcSecret = new sst.Secret("NEXUS_RPC_SECRET");
export const vapidPublicKey = new sst.Secret("VAPID_PUBLIC_KEY");
export const sessionEncryptionKy = new sst.Secret("SESSION_ENCRYPTION_KEY");
export const mongoBusinessDb = new sst.Secret("MONGODB_BUSINESS_URI");
export const onRampUrl = new sst.Secret("FUNDING_ON_RAMP_URL");
export const jwtBusinessSecret = new sst.Secret("JWT_BUSINESS_SECRET");

// Shopify
export const shopifyClientId = new sst.Secret("SHOPIFY_CLIENT_ID");
export const shopifyApiSecret = new sst.Secret("SHOPIFY_API_SECRET");

// Shopify app secrets (separate from backend Postgres)
export const shopifyPostgresHost = new sst.Secret("SHOPIFY_POSTGRES_HOST");
export const shopifyPostgresPassword = new sst.Secret(
    "SHOPIFY_POSTGRES_PASSWORD"
);
export const productSetupCodeSalt = new sst.Secret("PRODUCT_SETUP_CODE_SALT");

// Shopify app URL configs
export const shopifyAppUrl = isProd
    ? "https://extension-shop.frak.id"
    : "https://extension-shop-dev.frak.id";
export const shopifyApiKey = isProd
    ? "87da8338f40c95301b4881ca4bfb23db"
    : "de34932679bc2a2c5a8dddb21a216247";

// Android signing key fingerprint (shared by frontend + backend for WebAuthn + assetlinks)
export const androidSha256Fingerprint = new sst.Secret(
    "ANDROID_SHA256_FINGERPRINT"
);

// Open panel secrets
export const openPanelWalletClientId = new sst.Secret(
    "OPEN_PANEL_WALLET_CLIENT_ID"
);
export const openPanelSdkClientId = new sst.Secret("OPEN_PANEL_SDK_CLIENT_ID");
export const openPanelBusinessClientId = new sst.Secret(
    "OPEN_PANEL_BUSINESS_CLIENT_ID"
);
