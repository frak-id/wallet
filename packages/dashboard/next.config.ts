import type { NextConfig } from "next";
import { Resource } from "sst";

const DEBUG = false;

// Secret env variable from SST we want in the frontend
const wantedFromConfig = [
    "DRPC_API_KEY",
    "NEXUS_RPC_SECRET",
    "SESSION_ENCRYPTION_KEY",
    "MONGODB_BUSINESS_URI",
    "FUNDING_ON_RAMP_URL",
] as string[];

// Get the env variables from the Resource
const envFromSst: Record<string, string> = {};
for (const key of wantedFromConfig) {
    // If the key is not in the Resource, skip
    if (!(key in Resource)) continue;
    // Get the value from the Resource
    const value = Resource[key as keyof typeof Resource];
    // If the value is an object with a value property, add it to the envFromSst object
    if (value && typeof value === "object" && "value" in value) {
        envFromSst[key] = value.value as string;
    }
}
const isDistant = ["prod", "dev"].includes(Resource.App.stage);

const nextConfig: NextConfig = {
    async redirects() {
        return [
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
        DEBUG: JSON.stringify(DEBUG),
        // Secrets from sst
        ...envFromSst,
    },
    transpilePackages: ["lucide-react", "@frak-labs/app-essentials"],
    compiler: {
        removeConsole: isDistant,
    },
    output: "standalone",
};

export default nextConfig;
