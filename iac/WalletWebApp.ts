import type { StackContext } from "sst/constructs";
import { use } from "sst/constructs";
import { NextjsSite } from "sst/constructs";
import { ConfigStack } from "./Config";
import { isProdStack, openNextVersion } from "./utils";

/**
 * Define the wallet webapp SST stack
 * @param stack
 * @constructor
 */
export function WalletAppStack({ stack }: StackContext) {
    // The configs required to run the app
    const {
        sessionEncryptionKey,
        mongoNexusUri,
        alchemyApiKey,
        pimlicoApiKey,
        frakWalletUrl,
        nexusRpcSecret,
        vapidPublicKey,
        vapidPrivateKey,
        backendUrl,
        indexerUrl,
    } = use(ConfigStack);
    const configs = [
        sessionEncryptionKey,
        mongoNexusUri,
        alchemyApiKey,
        pimlicoApiKey,
        frakWalletUrl,
        nexusRpcSecret,
        vapidPublicKey,
        vapidPrivateKey,
        backendUrl,
        indexerUrl,
    ];

    // Base domain for our whole app
    const subDomain = isProdStack(stack)
        ? "nexus"
        : `nexus-${stack.stage.toLowerCase()}`;

    // Declare the Next.js site
    const site = new NextjsSite(stack, "wallet", {
        path: "packages/wallet",
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
        // Number of server side instance to keep warm
        warm: 1,
        dev: {
            deploy: false,
        },
    });

    stack.addOutputs({
        SiteUrl: site.url,
    });
}
