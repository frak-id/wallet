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
    const { sessionEncryptionKey, mongoUri, nexusUrl, adminPassword } =
        use(ConfigStack);
    const configs = [sessionEncryptionKey, mongoUri, nexusUrl, adminPassword];

    // Base domain for our whole app
    const subDomain = isDevStack(stack)
        ? "news-example"
        : `news-example-${stack.stage.toLowerCase()}`;

    // Declare the Next.js site
    const site = new NextjsSite(stack, "example", {
        path: "packages/example",
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
        warm: 10,
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
    });

    stack.addOutputs({
        SiteUrl: site.url,
    });
}
