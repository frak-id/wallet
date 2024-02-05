import { pick } from "radash";
import { Config } from "sst/node/config";

// Secret env variable from SST we want in the frontend
const wantedFromConfig = ["SESSION_ENCRYPTION_KEY", "FRAK_WALLET_URL"];
const envFromSstConfig = pick(Config, wantedFromConfig);

/** @type {import('next').NextConfig} */
const nextConfig = {
    env: { ...envFromSstConfig },
    transpilePackages: ["lucide-react"],
};

export default nextConfig;
