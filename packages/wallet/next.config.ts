import type { NextConfig } from "next";
import { pick } from "radash";
import { Config } from "sst/node/config";

// Secret env variable from SST we want in the frontend
const wantedFromConfig: (keyof typeof Config)[] = [
    "ALCHEMY_API_KEY",
    "PIMLICO_API_KEY",
    "NEXUS_RPC_SECRET",
    // TODO: Shouldn't be here, but Next is crying all over the place when using SST.Config, to fix
    "VAPID_PUBLIC_KEY",
    "VAPID_PRIVATE_KEY",
    "BACKEND_URL",
    "INDEXER_URL",
];
const envFromSstConfig = pick(Config, wantedFromConfig);

const nextConfig: NextConfig = {
    env: {
        ...envFromSstConfig,
        STAGE: Config.STAGE,
        APP_URL: Config.FRAK_WALLET_URL,
    },
    transpilePackages: ["lucide-react", "@frak-labs/app-essentials"],
    compiler: {
        removeConsole: Config.STAGE === "prod",
    },
    output: "standalone",
    experimental: {
        reactCompiler: true,
    },
};

export default nextConfig;
