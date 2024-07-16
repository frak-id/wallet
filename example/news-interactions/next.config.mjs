import { pick } from "radash";
import { Config } from "sst/node/config";

// Secret env variable from SST we want in the frontend
const wantedFromConfig = [
    "WORLD_NEWS_API_KEY",
    "NEXUS_WALLET_URL",
    "MONGODB_FRAK_POC_URI",
];
const envFromSstConfig = pick(Config, wantedFromConfig);

const isDistant = ["dev", "prod"].includes(Config.STAGE);

/** @type {import('next').NextConfig} */
const nextConfig = {
    env: {
        ...envFromSstConfig,
        STAGE: Config.STAGE,
    },
    compiler: {
        removeConsole: isDistant,
    },
    output: "standalone",
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "news-paper.xyz",
            },
            {
                protocol: "http",
                hostname: "localhost",
            },
        ],
    },
};

export default nextConfig;
