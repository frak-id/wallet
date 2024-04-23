import { pick } from "radash";
import { Config } from "sst/node/config";

// Secret env variable from SST we want in the frontend
const wantedFromConfig = [
    "SESSION_ENCRYPTION_KEY",
    "NEXUS_WALLET_URL",
    // Shouldn't be in env but rather in direct Config usage
    "MONGODB_FRAK_POC_URI",
    "ADMIN_PASSWORD",
];
const envFromSstConfig = pick(Config, wantedFromConfig);

const isDistant = ["dev", "prod"].includes(Config.STAGE);

/** @type {import('next').NextConfig} */
const nextConfig = {
    env: {
        ...envFromSstConfig,
        STAGE: Config.STAGE,
    },
    transpilePackages: ["lucide-react"],
    compiler: {
        removeConsole: isDistant,
    },
    output: "standalone",
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "news-example.frak.id",
            },
            {
                protocol: "http",
                hostname: "localhost",
            },
        ],
    },
};

export default nextConfig;
