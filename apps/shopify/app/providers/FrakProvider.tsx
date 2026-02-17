import {
    FrakConfigProvider,
    FrakIFrameClientProvider,
} from "@frak-labs/react-sdk";
import type { loader as appLoader } from "app/routes/app";
import type { PropsWithChildren } from "react";
import { useRouteLoaderData } from "react-router";

export function FrakProvider({ children }: PropsWithChildren) {
    const rootData = useRouteLoaderData<typeof appLoader>("routes/app");

    const frakWalletSdkConfig = {
        walletUrl: process.env.FRAK_WALLET_URL ?? "https://wallet.frak.id",
        metadata: {
            name: "Shopify App",
            ...(rootData?.merchantId && {
                merchantId: rootData.merchantId,
            }),
        },
        domain: "app-shopify.frak.id",
    };

    return (
        <FrakConfigProvider config={frakWalletSdkConfig}>
            <FrakIFrameClientProvider>{children}</FrakIFrameClientProvider>
        </FrakConfigProvider>
    );
}
