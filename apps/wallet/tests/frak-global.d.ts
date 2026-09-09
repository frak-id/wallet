import type { FrakClient } from "@frak-labs/core-sdk";
import type * as FrakCore from "@frak-labs/core-sdk/bundle";

declare global {
    /**
     * What the merchant harness publishes for the SDK. Declared here so specs
     * read `window.FrakSetup` as a typed value instead of asserting a shape at
     * every call site.
     */
    interface Window {
        FrakSetup?: {
            client?: FrakClient;
            core?: typeof FrakCore;
        };
    }
}
