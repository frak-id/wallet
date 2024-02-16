import type { StackContext } from "sst/constructs";
import { use } from "sst/constructs";
import { NextjsSite } from "sst/constructs";
import { ConfigStack } from "./Config";

/**
 * Define the wallet webapp SST stack
 * @param stack
 * @constructor
 */
export function WalletAppStack({ stack }: StackContext) {
    // The configs required to run the app
    const {
        sessionEncryptionKey,
        mongoUri,
        rpcUrl,
        pimlicoApiKey,
        airdropPrivateKey,
    } = use(ConfigStack);
    const configs = [
        sessionEncryptionKey,
        mongoUri,
        rpcUrl,
        pimlicoApiKey,
        airdropPrivateKey,
    ];

    // Base domain for our whole app
    const subDomain =
        stack.stage === "prod"
            ? "poc-wallet"
            : `poc-wallet-${stack.stage.toLowerCase()}`;

    // Declare the Next.js site
    const site = new NextjsSite(stack, "wallet", {
        path: "packages/wallet",
        // Set the custom domain
        customDomain: {
            domainName: `${subDomain}.frak.id`.toLowerCase(),
            hostedZone: "frak.id",
        },
        // Bind to the configs
        bind: configs,
        // Set to combined logging to prevent SSR huuuge cost
        logging: "combined",
        openNextVersion: "2.3.6",
        // Number of server side instance to keep warm
        warm: 3,
    });

    stack.addOutputs({
        SiteUrl: site.url,
    });
}
