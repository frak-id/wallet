import { type StackContext, use } from "sst/constructs";
import { NextjsSite } from "sst/constructs";
import { BackendStack } from "./Backend";
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
        nexusUrl,
        sessionEncryptionKey,
        mongoBusinessUri,
        contentMinterPrivateKey,
    } = use(ConfigStack);
    const configs = [
        alchemyApiKey,
        nexusRpcSecret,
        nexusUrl,
        sessionEncryptionKey,
        mongoBusinessUri,
        contentMinterPrivateKey,
    ];

    // Get a few backend resources we will bind to the frontend
    const { reloadCampaignQueue, readPubKeyFunction } = use(BackendStack);

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
        bind: [...configs, reloadCampaignQueue, readPubKeyFunction],
        openNextVersion: openNextVersion,
        // Number of server side instance to keep warm
        warm: isProdStack(stack) ? 10 : 1,
    });

    stack.addOutputs({
        SiteUrl: site.url,
    });
}
