import type { NextConfig } from "next";
import { pick } from "radash";
import { Config } from "sst/node/config";

// Secret env variable from SST we want in the frontend
const wantedFromConfig: (keyof typeof Config)[] = [
    "FRAK_WALLET_URL",
    "BACKEND_URL",
];
const envFromSstConfig = pick(Config, wantedFromConfig);

const nextConfig: NextConfig = {
    env: {
        ...envFromSstConfig,
        STAGE: Config.STAGE,
    },
    compiler: {
        removeConsole: Config.STAGE === "prod",
    },
    output: "standalone",
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "**",
            },
            {
                protocol: "http",
                hostname: "localhost",
            },
        ],
    },
    experimental: {
        reactCompiler: true,
    },
};

export default nextConfig;
