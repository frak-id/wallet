import type { NextConfig } from "next";
import { pick } from "radash";
import { Config } from "sst/node/config";

// Secret env variable from SST we want in the frontend
const wantedFromConfig: (keyof typeof Config)[] = ["FRAK_WALLET_URL"];
const envFromSstConfig = pick(Config, wantedFromConfig);

const nextConfig: NextConfig = {
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
                hostname: "news-paper.xyz",
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
