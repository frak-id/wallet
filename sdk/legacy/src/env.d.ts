import type { FrakWalletSdkConfig } from "@frak-labs/core-sdk";

declare global {
    namespace NodeJS {
        interface ProcessEnv {
            CDN_TAG: string;
        }
    }

    // `define` substitutes only the literal `process.env.CDN_TAG`; the narrow
    // type is deliberate, so any other member fails to compile.
    const process: { env: NodeJS.ProcessEnv };

    // Compile-time only (`dts: false`); mirrors sdk/components/src/types/global.d.ts.
    interface Window {
        FrakSetup: {
            config?: FrakWalletSdkConfig;
            modalWalletConfig?: { metadata?: { position?: "left" | "right" } };
        };
    }
}
