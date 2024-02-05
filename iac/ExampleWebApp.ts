import { use } from "sst/constructs";
import type { StackContext } from "sst/constructs";
import { NextjsSite } from "sst/constructs";
import { ConfigStack } from "./Config";

/**
 * Define the example webapp SST stack
 * @param stack
 * @constructor
 */
export function ExampleAppStack({ stack }: StackContext) {
    // The configs required to run the app
    const { sessionEncryptionKey, mongoUri, frakWalletUrl } = use(ConfigStack);
    const configs = [sessionEncryptionKey, mongoUri, frakWalletUrl];

    // Base domain for our whole app
    const subDomain =
        stack.stage === "prod"
            ? "article"
            : `article-${stack.stage.toLowerCase()}`;

    // Declare the Next.js site
    const site = new NextjsSite(stack, "example", {
        path: "packages/example",
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
