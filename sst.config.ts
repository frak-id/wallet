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
        // Import the master VPC
        await import("./infra/config.ts");

        if ($app.stage !== "production") {
            // Deploy example only on non prod variant
            await import("./infra/example.ts");
        }
    },
});
