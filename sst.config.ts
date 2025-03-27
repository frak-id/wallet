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
                kubernetes: "4.22.1",
                "docker-build": "0.0.10",
                gcp: {
                    version: "8.22.0",
                    project: "frak-main-v1",
                    region: "europe-west1",
                },
                docker: "4.6.1",
            },
        };
    },
    async run() {
        const isGcp = $app?.stage?.startsWith("gcp");

        // If on gcp, only deploy the backend
        if (isGcp) {
            // await import("./infra/gcp/backend.ts");
            return;
        }

        // Some config
        await import("./infra/config.ts");

        // Build the sdk on dev env
        if ($dev) {
            new sst.x.DevCommand("sdk:build", {
                dev: {
                    title: "Build SDK",
                    autostart: false,
                    command: "bun run build:sdk",
                    directory: "./",
                },
            });
        }

        // Deploy backend
        await import("./infra/backend.ts");

        // Add wallet + dashboard
        await import("./infra/wallet.ts");
        await import("./infra/dashboard.ts");

        // Deploy example on non prod stacks
        if ($app.stage !== "prod") {
            await import("./infra/example.ts");
        }
    },
});
