import path from "node:path";
import { ChildCompilationPlugin } from "@serwist/webpack-plugin/internal";
import { pick } from "radash";
import { Config } from "sst/node/config";
import { Queue } from "sst/node/queue";

// Secret env variable from SST we want in the frontend
const wantedFromConfig = [
    "ALCHEMY_API_KEY",
    "PIMLICO_API_KEY",
    "NEXUS_RPC_SECRET",
    // TODO: Shouldn't be here, but Next is crying all over the place when using SST.Config, to fix
    "MONGODB_NEXUS_URI",
    "SESSION_ENCRYPTION_KEY",
    "AIRDROP_PRIVATE_KEY",
    "VAPID_PUBLIC_KEY",
    "VAPID_PRIVATE_KEY",
];
const envFromSstConfig = pick(Config, wantedFromConfig);

/** @type {import('next').NextConfig} */
const nextConfig = {
    env: {
        ...envFromSstConfig,
        STAGE: Config.STAGE,
        APP_URL: Config.NEXUS_WALLET_URL,
        INTERACTION_QUEUE_URL: Queue.InteractionQueue.queueUrl,
    },
    transpilePackages: ["lucide-react"],
    compiler: {
        removeConsole: Config.STAGE === "prod",
    },
    output: "standalone",
    // Custom webpack config to also bundle the service-worker file
    webpack: (config, { isServer, dir }) => {
        // For server case, directly return the config
        if (isServer) {
            return config;
        }

        // Otherwise, add the plugin to bundle the service-worker
        config.plugins.push(
            new ChildCompilationPlugin({
                src: path.join(dir, "src/app/service-worker.ts"),
                dest: path.resolve(dir, "public/sw.js"),
            })
        );

        return config;
    },
};

export default nextConfig;
