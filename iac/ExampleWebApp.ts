import { use } from "sst/constructs";
import type { StackContext } from "sst/constructs";
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
    const {
        sessionEncryptionKey,
        mongoExampleUri,
        nexusUrl,
        adminPassword,
        worldNewsApiKey,
    } = use(ConfigStack);
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

    // Declare the next-js site on news-example.frak.id
    const exampleSite = new NextjsSite(stack, "example", {
        path: "example/news",
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
        // Set the custom domain
        customDomain: {
            domainName: `${subDomain}.frak.id`.toLowerCase(),
            hostedZone: "frak.id",
        },
    });

    // Declare the next js site on news-paper.xyz
    // Use it for the ETH-CC demo
    const ethCCDemo = new NextjsSite(stack, "walletExampleEthCC", {
        path: "example/wallet-ethcc",
        // Bind to the configs
        bind: [nexusUrl],
        openNextVersion: "3.0.6",
        // Number of server side instance to keep warm
        warm: 10,
        // Set the custom domain
        customDomain: {
            domainName: "ethcc.news-paper.xyz",
            hostedZone: "news-paper.xyz",
        },
    });

    // Declare the next js site on news-paper.xyz
    // Use it for the ETH-CC demo
    const newsInteractionDemo = new NextjsSite(stack, "newsInteractionDemo", {
        path: "example/news-interactions",
        // Bind to the configs
        bind: [nexusUrl, worldNewsApiKey, mongoExampleUri],
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
        NewsSiteUrl: ethCCDemo.url,
        NewsInteractionSiteUrl: newsInteractionDemo.url,
    });
}
