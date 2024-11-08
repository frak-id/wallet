import {
    NexusConfigProvider,
    NexusIFrameClientProvider,
} from "@frak-labs/nexus-sdk/react";
import type { PropsWithChildren } from "react";

export function FrakProvider({ children }: PropsWithChildren) {
    const frakWalletSdkConfig = {
        walletUrl: process.env.FRAK_WALLET_URL as string,
        metadata: {
            name: "Demo - EthCC",
        },
        domain: "ethcc.news-paper.xyz",
    };

    return (
        <NexusConfigProvider config={frakWalletSdkConfig}>
            <NexusIFrameClientProvider>{children}</NexusIFrameClientProvider>
        </NexusConfigProvider>
    );
}
