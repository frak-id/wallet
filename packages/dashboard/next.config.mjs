import { pick } from "radash";
import { Resource } from "sst";

// Secret env variable from SST we want in the frontend
const wantedFromConfig = [
    "ALCHEMY_API_KEY",
    "NEXUS_RPC_SECRET",
    "FRAK_WALLET_URL",
    "SESSION_ENCRYPTION_KEY",
    "MONGODB_BUSINESS_URI",
    "BACKEND_URL",
    "INDEXER_URL",
    "FUNDING_ON_RAMP_URL",
];
const envFromSstConfig = pick(Resource, wantedFromConfig);

const isDistant = ["prod", "dev"].includes(Resource.App.stage);

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
