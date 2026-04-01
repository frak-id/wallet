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
                kubernetes: "4.25.0",
                "docker-build": "0.0.15",
                gcp: {
                    version: "9.10.0",
                    project: "frak-main-v1",
                    region: "europe-west1",
                },
            },
        };
    },
    async run() {
        // Check if we are deploying the example stack
        const isExample = $app?.stage?.startsWith("example");
        if (isExample) {
            await import("./infra/example.ts");
            return;
        }

        // Check if we are deploying on GCP (only `services` are deployed on GCP)
        const isGcp = $app?.stage?.startsWith("gcp");
        if (isGcp) {
            await import("./infra/gcp/backend.ts");
            await import("./infra/gcp/credential-sync.ts");
            await import("./infra/gcp/wallet.ts");
            await import("./infra/gcp/business.ts");
            return;
        }

        // Check if we are running in dev (if yes, import basicly all the stacks and exit)
        if ($dev) {
            // Gcp dev stuff
            await import("./infra/gcp/dev.ts");
            await import("./infra/gcp/wallet.ts");
            await import("./infra/gcp/business.ts");
            await import("./infra/gcp/sandbox.ts");
            await import("./infra/example.ts");
            await import("./infra/shopify.ts");

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

        await import("./infra/shopify.ts");
    },
});
