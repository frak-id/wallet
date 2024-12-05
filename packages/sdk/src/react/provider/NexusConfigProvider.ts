import { type PropsWithChildren, createContext, createElement } from "react";
import type { NexusWalletSdkConfig } from "../../core";

/**
 * The context that will keep the Nexus Wallet SDK configuration
 */
export const NexusConfigContext = createContext<
    NexusWalletSdkConfig | undefined
>(undefined);

/**
 * Props to instantiate the Nexus Wallet SDK configuration provider
 */
export type NexusConfigProviderProps = {
    config: NexusWalletSdkConfig;
};

/**
 * Simple config provider for the Nexus Wallet SDK
 * @param parameters
 * @constructor
 */
export function NexusConfigProvider(
    parameters: PropsWithChildren<NexusConfigProviderProps>
) {
    const { children, config } = parameters;
    return createElement(
        NexusConfigContext.Provider,
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
