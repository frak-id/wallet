import type { FrakWalletSdkConfig } from "@frak-labs/core-sdk";
import { type PropsWithChildren, createContext, createElement } from "react";

/**
 * The context that will keep the Frak Wallet SDK configuration
 */
export const FrakConfigContext = createContext<FrakWalletSdkConfig | undefined>(
    undefined
);

/**
 * Props to instantiate the Frak Wallet SDK configuration provider
 */
export type FrakConfigProviderProps = {
    config: FrakWalletSdkConfig;
};

/**
 * Simple config provider for the Frak Wallet SDK
 * @param parameters
 * @constructor
 */
export function FrakConfigProvider(
    parameters: PropsWithChildren<FrakConfigProviderProps>
) {
    const { children, config } = parameters;
    return createElement(
        FrakConfigContext.Provider,
        {
            value: {
                ...config,
                walletUrl: config.walletUrl ?? "https://wallet.frak.id",
                domain:
                    config.domain ??
                    (typeof window !== "undefined"
                        ? window?.location?.host
                        : undefined) ??
                    "not-found",
            },
        },
        children
    );
}
