

import {pick} from "radash";
import {Config} from "sst/node/config";

// Secret env variable from SST we want in the frontend
const wantedFromConfig = [
    "RPC_URL",
    "PIMLICO_API_KEY"
];
const envFromSstConfig = pick(Config, wantedFromConfig);


/** @type {import('next').NextConfig} */
const nextConfig = {
    env: { ...envFromSstConfig },
};

export default nextConfig;
