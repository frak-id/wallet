import { type StackContext, use } from "sst/constructs";
import { NextjsSite } from "sst/constructs";
import { ConfigStack } from "./Config";
import { isProdStack } from "./utils";

/**
 * Define the wallet webapp SST stack
 * @param stack
 * @constructor
 */
export function DashboardWebApp({ stack }: StackContext) {
    // The configs required to run the app
    const { alchemyApiKeys, nexusUrl } = use(ConfigStack);
    const configs = [alchemyApiKeys, nexusUrl];

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
        // Bind to the configs
        bind: configs,
        // Set to combined logging to prevent SSR huuuge cost
        logging: "combined",
        openNextVersion: "2.3.8",
        // Number of server side instance to keep warm
        warm: 20,
    });

    stack.addOutputs({
        SiteUrl: site.url,
    });
}
