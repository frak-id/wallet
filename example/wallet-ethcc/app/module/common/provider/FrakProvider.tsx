import {
    FrakConfigProvider,
    FrakIFrameClientProvider,
} from "@frak-labs/react-sdk";
import { type PropsWithChildren, use } from "react";
import { detectFrakEnv } from "../../../../../shared/detectFrakEnv";

const envPromise = detectFrakEnv(
    import.meta.env.DEV,
    process.env.FRAK_WALLET_URL
        ? {
              wallet: process.env.FRAK_WALLET_URL,
              backend:
                  process.env.BACKEND_URL ?? "https://backend.gcp-dev.frak.id",
          }
        : "dev"
);

export function FrakProvider({ children }: PropsWithChildren) {
    const env = use(envPromise);

    const frakWalletSdkConfig = {
        env,
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
