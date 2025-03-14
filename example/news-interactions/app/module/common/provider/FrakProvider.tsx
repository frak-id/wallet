import {
    FrakConfigProvider,
    FrakIFrameClientProvider,
} from "@frak-labs/react-sdk";
import type { PropsWithChildren } from "react";

export function FrakProvider({ children }: PropsWithChildren) {
    const frakWalletSdkConfig = {
        walletUrl: process.env.FRAK_WALLET_URL as string,
        metadata: {
            name: "Good Vibes",
            lang: "fr" as const,
            currency: "eur" as const,
        },
        // Specify domain for valid test on localhost
        domain: "news-paper.xyz",
    };

    return (
        <FrakConfigProvider config={frakWalletSdkConfig}>
            <FrakIFrameClientProvider>{children}</FrakIFrameClientProvider>
        </FrakConfigProvider>
    );
}
