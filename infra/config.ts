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
export const stage = $app.stage ?? "dev";

// Some secrets
export const drpcApiKey = new sst.Secret("DRPC_API_KEY");
export const pimlicoApiKey = new sst.Secret("PIMLICO_API_KEY");
export const nexusRpcSecret = new sst.Secret("NEXUS_RPC_SECRET");
export const vapidPublicKey = new sst.Secret("VAPID_PUBLIC_KEY");
export const umamiWalletWebsiteId = new sst.Secret("UMAMI_WALLET_WEBSITE_ID");
export const sessionEncryptionKy = new sst.Secret("SESSION_ENCRYPTION_KEY");
export const mongoBusinessDb = new sst.Secret("MONGODB_BUSINESS_URI");
export const privyAppId = new sst.Secret("PRIVY_APP_ID");

export const postgresHost = new sst.Secret("POSTGRES_HOST");
export const postgresPassword = new sst.Secret("POSTGRES_PASSWORD");
