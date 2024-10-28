import { use } from "sst/constructs";
import type { StackContext } from "sst/constructs";
import { RemixSite } from "sst/constructs";
import { ConfigStack } from "./Config";
import { isProdStack } from "./utils";

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

    // Declare the remix site on news-paper.xyz
    // Use it for the ETH-CC demo
    const ethCCDemo = new RemixSite(stack, "walletExampleEthCC", {
        path: "example/wallet-ethcc",
        // Set the custom domain
        customDomain: {
            domainName: "ethcc.news-paper.xyz",
            hostedZone: "news-paper.xyz",
        },
        // Environment variables
        environment: {
            FRAK_WALLET_URL: frakWalletUrl.value,
            STAGE: stack.stage,
        },
    });

    // Declare the remix site on news-paper.xyz
    const newsInteractionDemo = new RemixSite(stack, "newsInteractionDemo", {
        path: "example/news-interactions",
        // Set the custom domain
        customDomain: {
            domainName: "news-paper.xyz",
            hostedZone: "news-paper.xyz",
        },
        // Environment variables
        environment: {
            FRAK_WALLET_URL: frakWalletUrl.value,
            BACKEND_URL: backendUrl.value,
        },
    });

    stack.addOutputs({
        NewsSiteUrl: ethCCDemo.url,
        NewsInteractionSiteUrl: newsInteractionDemo.url,
    });
}
