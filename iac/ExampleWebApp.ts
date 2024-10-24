import { use } from "sst/constructs";
import type { StackContext } from "sst/constructs";
import { NextjsSite, RemixSite } from "sst/constructs";
import { ConfigStack } from "./Config";
import { isProdStack, openNextVersion } from "./utils";

/**
 * Define the example webapp SST stack
 * @param stack
 * @constructor
 */
export function ExampleAppStack({ stack }: StackContext) {
    // If we are in prod don't deploy the example app
    if (isProdStack(stack)) {
        return;
    }

    // The configs required to run the app
    const { frakWalletUrl, backendUrl } = use(ConfigStack);

    // Declare the next js site on news-paper.xyz
    // Use it for the ETH-CC demo
    const ethCCDemo = new NextjsSite(stack, "walletExampleEthCC", {
        path: "example/wallet-ethcc",
        // Bind to the configs
        bind: [frakWalletUrl],
        openNextVersion: openNextVersion,
        // Set the custom domain
        customDomain: {
            domainName: "ethcc.news-paper.xyz",
            hostedZone: "news-paper.xyz",
        },
        // Enable image optimization
        imageOptimization: {
            memorySize: 512,
            staticImageOptimization: true,
        },
    });

    // Declare the next js site on news-paper.xyz
    // Use it for the ETH-CC demo
    const newsInteractionDemo = new NextjsSite(stack, "newsInteractionDemo", {
        path: "example/news-interactions",
        // Bind to the configs
        bind: [frakWalletUrl, backendUrl],
        openNextVersion: openNextVersion,
        // Set the custom domain
        customDomain: {
            domainName: "news-paper.xyz",
            hostedZone: "news-paper.xyz",
        },
        // Enable image optimization
        imageOptimization: {
            memorySize: 512,
            staticImageOptimization: true,
        },
    });

    const newsInteractionDemoRemix = new RemixSite(
        stack,
        "newsInteractionDemoRemix",
        {
            path: "example/news-interactions-remix",
            // Set the custom domain
            customDomain: {
                domainName: "news-paper-remix.frak.id",
                hostedZone: "frak.id",
            },
            environment: {
                FRAK_WALLET_URL: frakWalletUrl,
                BACKEND_URL: backendUrl,
            },
        }
    );

    stack.addOutputs({
        NewsSiteUrl: ethCCDemo.url,
        NewsInteractionSiteUrl: newsInteractionDemo.url,
        NewsInteractionRemixSiteUrl: newsInteractionDemoRemix.url,
    });
}
