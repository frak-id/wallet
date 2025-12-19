/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
    app(input) {
        return {
            name: "wallet",
            removal: input?.stage === "prod" ? "retain" : "remove",
            home: "aws",
            provider: {
                aws: {
                    region: "eu-west-1",
                },
            },
            providers: {
                kubernetes: "4.23.0",
                "docker-build": "0.0.12",
                gcp: {
                    version: "8.32.0",
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
            await import("./infra/dashboard-admin.ts");
            await import("./infra/example.ts");

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

        await import("./infra/dashboard-admin.ts");
    },
});
