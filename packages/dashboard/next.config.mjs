import { pick } from "radash";
import { Resource } from "sst";

// Secret env variable from SST we want in the frontend
const wantedFromConfig = [
    "ALCHEMY_API_KEY",
    "NEXUS_RPC_SECRET",
    "SESSION_ENCRYPTION_KEY",
    "MONGODB_BUSINESS_URI",
    "FUNDING_ON_RAMP_URL",
];
// The Resource.XXX can be an object with { value: string }, needed to upper up the value
const envFromSstConfig = Object.fromEntries(
    Object.entries(pick(Resource, wantedFromConfig)).map(([key, value]) => [
        key,
        value.value,
    ])
);

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
        // Some env variables
        STAGE: process.env.STAGE,
        FRAK_WALLET_URL: process.env.FRAK_WALLET_URL,
        BACKEND_URL: process.env.BACKEND_URL,
        INDEXER_URL: process.env.INDEXER_URL,
        // Secrets from sst
        ...envFromSstConfig,
    },
    transpilePackages: ["lucide-react", "@frak-labs/app-essentials"],
    compiler: {
        removeConsole: isDistant,
    },
    output: "standalone",
};

export default nextConfig;
