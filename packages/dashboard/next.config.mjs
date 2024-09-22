import { pick } from "radash";
import { Config } from "sst/node/config";

// Secret env variable from SST we want in the frontend
const wantedFromConfig = [
    "ALCHEMY_API_KEY",
    "NEXUS_RPC_SECRET",
    "NEXUS_WALLET_URL",
    "SESSION_ENCRYPTION_KEY",
    "MONGODB_BUSINESS_URI",
    "CONTENT_MINTER_PRIVATE_KEY",
    "BACKEND_URL",
    "INDEXER_URL",
];
const envFromSstConfig = pick(Config, wantedFromConfig);

const isDistant = ["prod", "dev"].includes(Config.STAGE);

/** @type {import('next').NextConfig} */
const nextConfig = {
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
    // tmp fix for terser build issue, see: https://github.com/vercel/next.js/issues/69263
    swcMinify: false,
};

export default nextConfig;
