import { use } from "sst/constructs";
import type { NextjsSiteProps, StackContext } from "sst/constructs";
import { NextjsSite } from "sst/constructs";
import { ConfigStack } from "./Config";
import { isDevStack, isProdStack } from "./utils";

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
    const { sessionEncryptionKey, mongoExampleUri, nexusUrl, adminPassword } =
        use(ConfigStack);
    const configs = [
        sessionEncryptionKey,
        mongoExampleUri,
        nexusUrl,
        adminPassword,
    ];

    // Base domain for our whole app
    const subDomain = isDevStack(stack)
        ? "news-example"
        : `news-example-${stack.stage.toLowerCase()}`;

    // Config for the webapp deployment
    const ssrConfig: Partial<NextjsSiteProps> = {
        path: "packages/example",
        // Bind to the configs
        bind: configs,
        openNextVersion: "3.0.6",
        // Number of server side instance to keep warm
        warm: isProdStack(stack) ? 10 : 1,
        // Cache options
        assets: {
            fileOptions: [
                // Cache articles html pages
                {
                    files: "_articles/**/*.html",
                    cacheControl: "public, max-age=1209600", // 14 days in seconds
                    contentType: "text/html",
                },
                // Cache article images
                {
                    files: "_articles/**/*.{jpg,jpeg,png,gif,webp}",
                    cacheControl: "public, max-age=1209600", // 14 days in seconds
                    contentType: "image/*",
                },
            ],
        },
    };

    // Declare the next-js site on news-example.frak.id
    const exampleSite = new NextjsSite(stack, "example", {
        // Set the custom domain
        customDomain: {
            domainName: `${subDomain}.frak.id`.toLowerCase(),
            hostedZone: "frak.id",
        },
        // Add the config
        ...ssrConfig,
    });

    // Declare the next js site on news-paper.xyz
    // Use it for the ETH-CC demo
    const newsSite = new NextjsSite(stack, "walletExampleEthCC", {
        path: "example/wallet-ethcc",
        // Bind to the configs
        bind: [nexusUrl],
        openNextVersion: "3.0.6",
        // Number of server side instance to keep warm
        warm: 10,
        // Set the custom domain
        customDomain: {
            domainName: "news-paper.xyz",
            hostedZone: "news-paper.xyz",
        },
    });

    stack.addOutputs({
        ExampleSiteUrl: exampleSite.url,
        NewsSiteUrl: newsSite.url,
    });
}
