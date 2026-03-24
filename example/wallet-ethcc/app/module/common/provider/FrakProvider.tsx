import {
    FrakConfigProvider,
    FrakIFrameClientProvider,
} from "@frak-labs/react-sdk";
import { type PropsWithChildren, use } from "react";
import { detectWalletUrl } from "../../../../../shared/detectWalletUrl";

const walletUrlPromise: Promise<string> = detectWalletUrl(
    import.meta.env.DEV,
    process.env.FRAK_WALLET_URL
);

export function FrakProvider({ children }: PropsWithChildren) {
    const walletUrl = use(walletUrlPromise);

    const frakWalletSdkConfig = {
        walletUrl,
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
        domain: "ethcc.frak-labs.com",
    };

    return (
        <FrakConfigProvider config={frakWalletSdkConfig}>
            <FrakIFrameClientProvider>{children}</FrakIFrameClientProvider>
        </FrakConfigProvider>
    );
}
