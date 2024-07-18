import type { SSTConfig } from "sst";
import { BackendStack } from "./iac/Backend";
import { ConfigStack } from "./iac/Config";
import { DashboardWebApp } from "./iac/DashboardWebApp";
import { ExampleAppStack } from "./iac/ExampleWebApp";
import { WalletAppStack } from "./iac/WalletWebApp";

export default {
    config(_input) {
        return {
            name: "wallet",
            region: "eu-west-1",
        };
    },
    stacks(app) {
        // Remove all resources when non-prod stages are removed
        app.setDefaultRemovalPolicy("destroy");
        // Global function properties
        app.setDefaultFunctionProps({
            // Log param's
            logRetention: "three_days",
            // Build params
            nodejs: {
                // Minify code
                minify: true,
                // Disable source map for non ci/cd stage
                sourcemap: false,
                // Build options for esbuild
                esbuild: {
                    // Bundle the packages
                    bundle: true,
                    // Always enable tree shaking
                    treeShaking: true,
                    // Override log level
                    logLevel: "warning",
                },
            },
            // Runtime node env
            runtime: "nodejs20.x",
            // Use arm64
            architecture: "arm_64",
            // Disable xray tracing
            tracing: "disabled",
        });

        app.stack(ConfigStack);

        app.stack(BackendStack);

        app.stack(WalletAppStack);
        app.stack(ExampleAppStack);
        app.stack(DashboardWebApp);
    },
} satisfies SSTConfig;
