import type { StackContext } from "sst/constructs";
import { RemixSite, use } from "sst/constructs";
import { ConfigStack } from "./Config";
import { isProdStack } from "./utils";

/**
 * Define the wallet webapp SST stack
 * @param stack
 * @constructor
 */
export function WalletAppStack({ stack }: StackContext) {
    // The configs required to run the app
    const {
        alchemyApiKey,
        pimlicoApiKey,
        frakWalletUrl,
        nexusRpcSecret,
        vapidPublicKey,
        backendUrl,
        indexerUrl,
        umamiWalletWebsiteId,
    } = use(ConfigStack);
    const configs = [
        alchemyApiKey,
        pimlicoApiKey,
        frakWalletUrl,
        nexusRpcSecret,
        vapidPublicKey,
        backendUrl,
        indexerUrl,
        umamiWalletWebsiteId,
    ];

    // Base domain for our whole app
    const subDomain = isProdStack(stack)
        ? "wallet"
        : `wallet-${stack.stage.toLowerCase()}`;

    // Declare the Remix site
    const site = new RemixSite(stack, "wallet", {
        path: "packages/wallet",
        // Set the custom domain
        customDomain: {
            domainName: `${subDomain}.frak.id`.toLowerCase(),
            hostedZone: "frak.id",
        },
        // Bind to the configs
        bind: configs,
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
