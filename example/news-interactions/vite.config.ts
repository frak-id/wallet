import { vitePlugin as remix } from "@remix-run/dev";
import { pick } from "radash";
import { Config } from "sst/node/config";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Secret env variable from SST we want in the frontend
const wantedFromConfig: (keyof typeof Config)[] = [
    "STAGE",
    "FRAK_WALLET_URL",
    "BACKEND_URL",
];
const envFromSstConfig = pick(Config, wantedFromConfig);

console.log(
    Object.fromEntries(
        Object.entries(envFromSstConfig).map(([key, value]) => [
            `process.env.${key}`,
            JSON.stringify(value),
        ])
    )
);

export default defineConfig({
    define: Object.fromEntries(
        Object.entries(envFromSstConfig).map(([key, value]) => [
            `process.env.${key}`,
            JSON.stringify(value),
        ])
    ),
    server: {
        port: 3011,
    },
    plugins: [remix(), tsconfigPaths()],
});
