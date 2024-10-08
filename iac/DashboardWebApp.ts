import { Config, type StackContext, use } from "sst/constructs";
import { NextjsSite } from "sst/constructs";
import { ConfigStack } from "./Config";
import { isProdStack, openNextVersion } from "./utils";

/**
 * Define the wallet webapp SST stack
 * @param stack
 * @constructor
 */
export function DashboardWebApp({ stack }: StackContext) {
    // The configs required to run the app
    const {
        alchemyApiKey,
        nexusRpcSecret,
        frakWalletUrl,
        sessionEncryptionKey,
        mongoBusinessUri,
        contentMinterPrivateKey,
        backendUrl,
        indexerUrl,
    } = use(ConfigStack);
    const configs = [
        alchemyApiKey,
        nexusRpcSecret,
        frakWalletUrl,
        sessionEncryptionKey,
        mongoBusinessUri,
        contentMinterPrivateKey,
        backendUrl,
        indexerUrl,
        new Config.Secret(stack, "FUNDING_ON_RAMP_URL"),
    ];

    // Base domain for our whole app
    const subDomain = isProdStack(stack)
        ? "business"
        : `business-${stack.stage.toLowerCase()}`;

    // Declare the Next.js site
    const site = new NextjsSite(stack, "dashboard", {
        path: "packages/dashboard",
        // Set the custom domain
        customDomain: {
            domainName: `${subDomain}.frak.id`.toLowerCase(),
            hostedZone: "frak.id",
        },
        // Enable image optimization
        imageOptimization: {
            memorySize: 512,
            staticImageOptimization: true,
        },
        // Bind to the configs
        bind: configs,
        openNextVersion: openNextVersion,
    });

    stack.addOutputs({
        SiteUrl: site.url,
    });
}
