import {
    FrakConfigProvider,
    FrakIFrameClientProvider,
} from "@frak-labs/react-sdk";
import { type PropsWithChildren, use } from "react";

const walletUrlPromise: Promise<string> = (async () => {
    const envUrl = process.env.FRAK_WALLET_URL;
    if (!envUrl || !import.meta.env.DEV) return envUrl ?? "";

    try {
        const response = await fetch("http://localhost:3010", {
            mode: "no-cors",
            signal: AbortSignal.timeout(1500),
        });
        if (response.type === "opaque" || response.ok) {
            return "http://localhost:3010";
        }
    } catch {
        // Intentional: dev-only probe via no-cors — opaque failures expected
    }

    return envUrl;
})();

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
