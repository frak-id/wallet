import { pick } from "radash";
import { Config } from "sst/node/config";

// Secret env variable from SST we want in the frontend
const wantedFromConfig = [
    "SESSION_ENCRYPTION_KEY",
    "FRAK_WALLET_URL",
    // Shouldn't be in env but rather in direct Config usage
    "MONGODB_FRAK_POC_URI",
    "ADMIN_PASSWORD",
];
const envFromSstConfig = pick(Config, wantedFromConfig);

/** @type {import('next').NextConfig} */
const nextConfig = {
    env: {
        ...envFromSstConfig,
        IS_LOCAL: (Config.STAGE !== "prod").toString(),
    },
    transpilePackages: ["lucide-react", "@frak-wallet/sdk"],
    compiler: {
        removeConsole: Config.STAGE === "prod",
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
