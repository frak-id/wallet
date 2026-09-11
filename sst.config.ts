/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
    app(input) {
        return {
            name: "wallet",
            removal: input?.stage === "prod" ? "retain" : "remove",
            home: "aws",
            // Only watch infra config for changes — dev commands (Vite, Bun)
            // handle their own file watching. Avoids SST watching build outputs
            // like src-tauri/target/ which overloads CPU/memory.
            watch: ["infra"],
            provider: {
                aws: {
                    region: "eu-west-1",
                },
            },
            providers: {
                kubernetes: "4.28.0",
                "docker-build": "0.0.15",
                gcp: {
                    version: "9.18.0",
                    project: "frak-main-v1",
                    region: "europe-west1",
                },
            },
        };
    },
    async run() {
        const isExample = $app?.stage?.startsWith("example");
        if (isExample) {
            await import("./infra/example.ts");
            return;
        }

        // Only `services` are deployed on GCP
        const isGcp = $app?.stage?.startsWith("gcp");
        if (isGcp) {
            await import("./infra/gcp/backend.ts");
            await import("./infra/gcp/credential-sync.ts");
            await import("./infra/gcp/wallet.ts");
            await import("./infra/gcp/business.ts");
            await import("./infra/gcp/shopify.ts");
            return;
        }

        if ($dev) {
            // Gcp dev stuff
            await import("./infra/gcp/dev.ts");
            await import("./infra/gcp/wallet.ts");
            await import("./infra/gcp/business.ts");
            await import("./infra/gcp/sandbox.ts");
            await import("./infra/example.ts");
            await import("./infra/gcp/shopify.ts");

            // SDK build command helper
            new sst.x.DevCommand("sdk:build", {
                dev: {
                    title: "Build SDK",
                    autostart: false,
                    command: "bun run build:sdk",
                    directory: "./",
                },
            });

            return;
        }

        // The plain AWS stages deploy no application infra, but must still load
        // `infra/config.ts` for its side effect: it declares the `STAGE` / `BACKEND_URL` /
        // `ERPC_URL` / `FRAK_WALLET_URL` / `OPEN_PANEL_API_URL` Linkables that the mobile
        // release build reads via `getSstResource()` under `sst shell --stage prod`.
        // Without it the wallet silently falls back to its hardcoded dev backend.
        await import("./infra/config.ts");
    },
});
