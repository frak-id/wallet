/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
    app(input) {
        return {
            name: "wallet",
            removal: input?.stage === "production" ? "retain" : "remove",
            home: "aws",
            provider: {
                aws: {
                    region: "eu-west-1",
                },
            },
        };
    },
    async run() {
        // Some config
        await import("./infra/config.ts");

        // Deploy backend

        // Add wallet + dashboard
        await import("./infra/wallet.ts");
        await import("./infra/dashboard.ts");

        // Deploy example on non prod stacks
        if ($app.stage !== "production") {
            await import("./infra/example.ts");
        }
    },
});
