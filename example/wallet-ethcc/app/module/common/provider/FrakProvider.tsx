import {
    FrakConfigProvider,
    FrakIFrameClientProvider,
} from "@frak-labs/react-sdk";
import type { PropsWithChildren } from "react";

export function FrakProvider({ children }: PropsWithChildren) {
    const frakWalletSdkConfig = {
        walletUrl: process.env.FRAK_WALLET_URL as string,
        metadata: {
            name: "Demo - EthCC",
        },
        customizations: {
            i18n: {
                en: {
                    "sdk.modal.sendTransaction.description":
                        "Sending ETHCC transaction on {{ productName }}",
                },
                fr: {
                    "sdk.modal.sendTransaction.description":
                        "Envoie de transaction ETHCC sur {{ productName }}",
                },
            },
        },
        domain: "ethcc.news-paper.xyz",
    };

    return (
        <FrakConfigProvider config={frakWalletSdkConfig}>
            <FrakIFrameClientProvider>{children}</FrakIFrameClientProvider>
        </FrakConfigProvider>
    );
}
