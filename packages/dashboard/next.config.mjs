import { pick } from "radash";
import { Config } from "sst/node/config";
import { Queue } from "sst/node/queue";

// Secret env variable from SST we want in the frontend
const wantedFromConfig = [
    "ALCHEMY_API_KEY",
    "NEXUS_RPC_SECRET",
    "NEXUS_WALLET_URL",
    "SESSION_ENCRYPTION_KEY",
    "MONGODB_BUSINESS_URI",
    "CONTENT_MINTER_PRIVATE_KEY",
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
        CAMPAIGN_RELOAD_QUEUE_URL: Queue.ReloadCampaignQueue.queueUrl,
    },
    transpilePackages: ["lucide-react"],
    compiler: {
        removeConsole: isDistant,
    },
    output: "standalone",
};

export default nextConfig;
