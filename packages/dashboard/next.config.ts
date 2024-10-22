import type { NextConfig } from "next";
import { pick } from "radash";
import { Config } from "sst/node/config";

// Secret env variable from SST we want in the frontend
const wantedFromConfig: (keyof typeof Config)[] = [
    "ALCHEMY_API_KEY",
    "NEXUS_RPC_SECRET",
    "FRAK_WALLET_URL",
    "SESSION_ENCRYPTION_KEY",
    "MONGODB_BUSINESS_URI",
    "BACKEND_URL",
    "INDEXER_URL",
    "FUNDING_ON_RAMP_URL",
];
const envFromSstConfig = pick(Config, wantedFromConfig);

const isDistant = ["prod", "dev"].includes(Config.STAGE);

const nextConfig: NextConfig = {
    async redirects() {
        return [
            {
                source: "/",
                destination: "/dashboard",
                permanent: true,
            },
            {
                source: "/campaigns",
                destination: "/campaigns/list",
                permanent: true,
            },
        ];
    },
    env: {
        ...envFromSstConfig,
        STAGE: Config.STAGE,
        // APP_URL: Config.NEXUS_DASHBOARD_URL,
    },
    transpilePackages: ["lucide-react", "@frak-labs/app-essentials"],
    compiler: {
        removeConsole: isDistant,
    },
    output: "standalone",
    experimental: {
        reactCompiler: true,
    },
};

export default nextConfig;
