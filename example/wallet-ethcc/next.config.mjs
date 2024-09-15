import { pick } from "radash";
import { Config } from "sst/node/config";

// Secret env variable from SST we want in the frontend
const wantedFromConfig = ["NEXUS_WALLET_URL"];
const envFromSstConfig = pick(Config, wantedFromConfig);

/** @type {import('next').NextConfig} */
const nextConfig = {
    env: {
        ...envFromSstConfig,
        STAGE: Config.STAGE,
    },
    transpilePackages: ["lucide-react"],
    output: "standalone",
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "example-news-paper.xyz",
            },
            {
                protocol: "http",
                hostname: "localhost",
            },
        ],
    },
};

export default nextConfig;
