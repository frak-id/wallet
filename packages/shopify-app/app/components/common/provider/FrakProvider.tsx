import {
    NexusConfigProvider,
    NexusIFrameClientProvider,
} from "@frak-labs/nexus-sdk/react";
import type { PropsWithChildren } from "react";

export function FrakProvider({ children }: PropsWithChildren) {
    const frakWalletSdkConfig = {
        walletUrl: "https://wallet.frak.id",
        metadata: {
            name: "Shopify App",
        },
        domain: "app-shopify.frak.id",
    };

    return (
        <NexusConfigProvider config={frakWalletSdkConfig}>
            <NexusIFrameClientProvider>{children}</NexusIFrameClientProvider>
        </NexusConfigProvider>
    );
}
