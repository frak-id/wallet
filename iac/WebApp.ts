import type { StackContext } from "sst/constructs";
import { Config, NextjsSite } from "sst/constructs";

/**
 * Define the wallet webapp SST stack
 * @param stack
 * @constructor
 */
export function WalletAppStack({ stack }: StackContext) {
    // The configs required to run the app
    const configs = [
        new Config.Secret(stack, "SESSION_ENCRYPTION_KEY"),
        new Config.Secret(stack, "MONGODB_FRAK_POC_URI"),
        new Config.Secret(stack, "RPC_URL"),
        new Config.Secret(stack, "PIMLICO_API_KEY"),
        new Config.Secret(stack, "AIRDROP_PRIVATE_KEY"),
    ];

    // Base domain for our whole app
    const subDomain =
        stack.stage === "prod"
            ? "wallet"
            : `wallet-${stack.stage.toLowerCase()}`;

    // Declare the Next.js site
    const site = new NextjsSite(stack, "wallet", {
        path: "packages/wallet",
        // Set the custom domain
        customDomain: {
            domainName: `${subDomain}`.toLowerCase(),
            hostedZone: "frak.id",
        },
        // Bind to the configs
        bind: configs,
        // Set to combined logging to prevent SSR huuuge cost
        logging: "combined",
        openNextVersion: "2.3.4",
        // Number of server side instance to keep warm
        warm: 3,
    });

    stack.addOutputs({
        SiteUrl: site.url,
    });
}
