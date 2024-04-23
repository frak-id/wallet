import { pick } from "radash";
import { Config } from "sst/node/config";

// Secret env variable from SST we want in the frontend
const wantedFromConfig = [
    "ALCHEMY_API_KEYS",
    "ZERODEV_API_KEY",
    "PIMLICO_API_KEY",
    "WALLETCONNECT_PROJECT_ID",
    // TODO: Shouldn't be here, but Next is crying all over the place when using SST.Config, to fix
    "MONGODB_FRAK_POC_URI",
    "SESSION_ENCRYPTION_KEY",
    "AIRDROP_PRIVATE_KEY",
];
const envFromSstConfig = pick(Config, wantedFromConfig);

/** @type {import('next').NextConfig} */
const nextConfig = {
    env: {
        ...envFromSstConfig,
        IS_LOCAL: (Config.STAGE !== "prod").toString(),
        APP_URL: Config.FRAK_WALLET_URL,
    },
    transpilePackages: ["lucide-react"],
    compiler: {
        removeConsole: Config.STAGE === "prod",
    },
    output: "standalone",
};

export default nextConfig;
