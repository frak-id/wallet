import { pick } from "radash";
import { Config } from "sst/node/config";

// Secret env variable from SST we want in the frontend
const wantedFromConfig = [
    "RPC_URL",
    "PIMLICO_API_KEY",
    // TODO: Shouldn't be here, but Next is crying all over the place when using SST.Config, to fix
    "MONGODB_FRAK_POC_URI",
];
const envFromSstConfig = pick(Config, wantedFromConfig);

/** @type {import('next').NextConfig} */
const nextConfig = {
    env: { ...envFromSstConfig },
    transpilePackages: ["lucide-react"],
};

export default nextConfig;
