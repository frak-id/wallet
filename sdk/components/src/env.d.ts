import type { SdkResolvedConfig } from "@frak-labs/core-sdk";

declare global {
    namespace NodeJS {
        interface ProcessEnv {
            SDK_VERSION: string;
            OPEN_PANEL_API_URL: string;
        }
    }

    const process: { env: NodeJS.ProcessEnv };

    interface WindowEventMap {
        "frak:config": CustomEvent<SdkResolvedConfig>;
    }
}
